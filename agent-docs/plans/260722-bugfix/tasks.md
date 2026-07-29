# Plan: Bugfix pass from tasks.txt

Request: Read tasks.txt and plan/implement the listed bugfixes.
Status: complete

## Decisions

- Generate tab: keep ChatPanel refine feature on success; only show a plain failure-reason message (no ChatPanel) when a Generate process failed.
- Gibberish mitigation: add generation params (maxTokens cap + frequency_penalty) AND detect degenerate output (replacement chars / long repeated runs) then retry the node once before failing.
- No DB migrations needed: `statusReason` is already a free-text column; new reason value `invalid_api_key` reuses it.

## Tasks

### Wave 1

- [x] T1: Add shared constants for status reasons and user-facing messages (commit e544564)
  - Files: `app/lib/constants.ts` (new)
  - Do: Create a constants-only module (no functions) exporting `STATUS_REASON` (`OUT_OF_CREDIT = 'out_of_credit'`, `INVALID_API_KEY = 'invalid_api_key'`) and `STATUS_REASON_MESSAGE`, a `Record<string, string>` mapping each reason to its user-facing text. Out-of-credit text: `"Free trial is over. Add your own OpenRouter API key in Settings, then re-analyze."`. Invalid-key text: `"Your OpenRouter API key is invalid. Update it in Settings, then re-analyze."`. Consumers index `STATUS_REASON_MESSAGE[reason]` directly.
  - Done when: Module compiles and exports the constants; no helper functions; no other files changed yet.

- [x] T2: Fix settings route API-key existence check and insert values (commit 82da932)
  - Files: `app/api/settings/route.ts`
  - Do: In GET, stop pulling the encrypted key; select existence via SQL (`sql<boolean>` `... IS NOT NULL`) so `hasOpenrouterApiKey` comes from one query without transferring the ciphertext. In PUT, build the insert `.values()` object so `openrouterApiKey` is only included when `shouldSetApiKey` is true (let the column default to null otherwise), keeping the existing `onConflictDoUpdate.set` behavior that only touches the key on set/clear intent. Preserve the existing no-op short-circuit.
  - Done when: Saving only instructions never sends/writes an `openrouterApiKey` value; GET returns correct `hasOpenrouterApiKey` without selecting the ciphertext; `pnpm lint` clean.

- [x] T3: Reanalyze deletes stale failed run before restarting (commit adbc80b)
  - Files: `app/api/jobs/[id]/analyze/route.ts`
  - Do: When the job is not in progress and not all-done (i.e., a prior run left failed/terminal processes), delete the stale run before inserting fresh processes: delete existing `process` rows for the job, and delete prior result rows for the job in `company`, `jobDescriptionMatch`, `resumeFeedback`, `coverLetterHistory`, `messageGenHistory`. Then insert the 5 fresh process rows and call `runWorkflow` as today. Keep the all-done early-return and the in-progress guard unchanged. Scope every delete by `jobId` (and `userId` where the column exists).
  - Done when: Re-analyzing a fully/partially failed job removes old process + result rows instead of accumulating a second set; a successful completed job still short-circuits; `pnpm lint` clean.

- [x] T4: Fix job selection/loading state across navigation and deep links (commit 7c05fc3)
  - Files: `app/resumes/page.tsx`, `app/resumes/[id]/page.tsx`, `app/lib/app-store.tsx`
  - Do:
    - "To Job" bug: when navigating from Resumes to the job page, clear the stale `selectedJobId` so the job screen opens clean instead of highlighting the first job with an empty right panel. Clear it in the resumes page "To Job" handler (call `selectJob(null)` before `router.push`), or reset it on job-page mount. Ensure the right panel and sidebar selection are consistent (no highlighted job without loaded content).
    - Deep-link bug (`/resumes/{resumeId}` opened directly without selecting): on the job page mount, if `selectedResumeId` in the store does not match the URL `resumeId`, sync it via `selectResume(resumeId)` so store-dependent actions (e.g., `addJob`, "Back to Resumes" highlighting) work.
  - Done when: Coming back from Settings and pressing "To Job" opens the job screen with no phantom-highlighted empty job; deep-linking to a resume's job URL loads that resume into the store so adding a job and back-navigation work; `pnpm lint` clean.

### Wave 2

- [x] T5: OpenRouter key decryption, auth-error detection, gibberish mitigation (commit 5256717)
  - Files: `app/lib/openrouter.ts`, `app/lib/workflow.ts`
  - Do:
    - openrouter.ts: change `createReasoningLlm`/`createWritingLlm` to accept the ENCRYPTED key and decrypt internally (import `decrypt`, wrap in try/catch, fall back to server key on failure). Add generation params to reduce degeneration: a `maxTokens` cap and `modelKwargs: { frequency_penalty: 0.3 }` (apply the frequency_penalty at minimum to the reasoning LLM). Add `isAuthError(error)` detecting `error.constructor.name === 'AuthenticationError'` with status/code 401. Import reason constants from `app/lib/constants.ts` if useful, but keep detection returning booleans.
    - workflow.ts: stop importing/using `decrypt`; pass `userSettingsRow?.openrouterApiKey` (the encrypted value) directly to the LLM factories. Replace hardcoded `'out_of_credit'` with `STATUS_REASON.OUT_OF_CREDIT` from constants. In each catch, also detect auth errors via `isAuthError` and set `statusReason = STATUS_REASON.INVALID_API_KEY` (out-of-credit takes precedence if both match). Apply the same reason mapping in the outer catch that force-fails leftover rows. Gibberish mitigation for `run_ResearchCompany` and `run_CrossRef`: after generating, run a local `isGibberish(text)` check (e.g., high ratio of Unicode replacement chars / non-printable chars, or a very long run of a repeated substring); if it looks degenerate, retry the node's generation once, and if still bad treat it as a failure for that node.
  - Done when: Workflow no longer decrypts keys itself; invalid key marks processes with `invalid_api_key`; out-of-credit still marks `out_of_credit`; a gibberish first response is retried once for the two research nodes; `pnpm build` succeeds.

- [x] T6: Analysis report failure reasons and Generate-tab behavior (commit 36af354)
  - Files: `app/lib/components/AnalysisReport.tsx`, `app/lib/components/ym/ChatPanel.tsx`
  - Do:
    - AnalysisReport: for Company/JDMatch/Feedback tabs, on `Failed` status render the mapped reason via `STATUS_REASON_MESSAGE[getProcessReason(...) ?? '']`, falling back to the current generic "Analysis failed for this section." when no mapped reason. For the Generate tab, keep ChatPanel when generation is in progress or succeeded, but when the relevant Generate process(es) failed, render a plain failure-reason message (mapped via `STATUS_REASON_MESSAGE`, generic fallback) instead of ChatPanel.
    - ChatPanel: replace the inline hardcoded out-of-credit string with the shared message from `app/lib/constants.ts`; keep the generic fallback for other failures. (This keeps ChatPanel's own failure text consistent for any path that still renders it.)
  - Done when: A failed Company/JDMatch/Feedback tab shows the specific reason (e.g., the free-trial-over message) when present; the Generate tab hides ChatPanel and shows the reason on failure but keeps chat refinement on success; the out-of-credit text is sourced from the shared constant everywhere; `pnpm lint`/`pnpm build` clean.

## Code Review (medium)
- app/lib/openrouter.ts:20 maxTokens: 2048 on the reasoning/writing LLM could silently truncate long structured outputs (resume feedback, company research), persisting incomplete markdown as Done. Fixed by raising the cap to 4096, which still bounds runaway repetition. (commit 49b2f82)

## Waves summary

- Wave 1 (parallel, no cross-file overlap): T1 constants, T2 settings, T3 reanalyze cleanup, T4 navigation/selection.
- Wave 2 (parallel, depend on T1): T5 openrouter+workflow, T6 report+chat UI.
