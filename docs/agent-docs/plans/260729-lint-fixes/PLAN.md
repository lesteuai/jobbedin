# Plan: Clear all eslint errors and warnings

Status: draft
Request: run 'npm run lint' and work on fixing the errors and warnings

## Baseline

`npm run lint` (eslint 9 flat config, `eslint-config-next` core-web-vitals + typescript) reports **3 errors and 11 warnings**:

| File | Line | Rule | Issue |
|---|---|---|---|
| app/lib/app-store.tsx | 66 | react-hooks/set-state-in-effect | `refreshResumes()` called in effect body |
| app/lib/app-store.tsx | 68 | react-hooks/exhaustive-deps | missing dep `refreshResumes` |
| app/lib/app-store.tsx | 72 | react-hooks/set-state-in-effect | `setJobs([])` in effect body |
| app/lib/components/ym/ChatPanel.tsx | 78 | no-unused-vars | unused `node` in markdown component override |
| app/lib/components/ym/MarkdownPanel.tsx | 16, 21, 26, 29 | no-unused-vars | unused `node` (4x) |
| app/lib/hooks/use-chat.ts | 46 | react-hooks/exhaustive-deps | missing dep `showError` |
| app/resumes/[id]/page.tsx | 33 | no-unused-vars | `isAnalyzing` assigned, never read |
| app/resumes/[id]/page.tsx | 64 | react-hooks/exhaustive-deps | missing deps `fetchJobs`, `selectJob` |
| app/resumes/[id]/page.tsx | 70 | react-hooks/exhaustive-deps | missing dep `selectResume` |
| app/resumes/[id]/page.tsx | 118 | react-hooks/set-state-in-effect | `setAnalysisData(null)` etc. in effect body |
| coverage/block-navigation.js | 1 | unused eslint-disable | generated istanbul output is being linted |

## Approach

Fix each violation at its source rather than suppressing rules. Three patterns cover everything: (1) move async data loading fully inside the effect so no state setter is reached synchronously and the dependency list closes over only primitives; (2) delete reset-only effects and perform the reset in the event handlers that actually cause the transition; (3) drop unused destructured bindings and lint-exempt the generated `coverage/` directory.

Verified empirically on `app-store.tsx`: inlining the fetch body into the effect and depending on a hoisted `userId` primitive clears both the `set-state-in-effect` error and the `exhaustive-deps` warning for that effect. The same shape is applied to the other effects.

## Affected Code

- `eslint.config.mjs`: add `coverage/**` to `globalIgnores` (istanbul output, already gitignored).
- `app/lib/app-store.tsx`:
  - Hoist `const userId = session?.user?.id;`.
  - Replace the `refreshResumes()` effect with an inlined, cancellable async loader depending on `[userId]`. Keep the exported `refreshResumes` in the context value for callers.
  - Delete the second effect (lines 70-75); its only job is `setJobs([])` when no resume is selected. Clear jobs explicitly in `deleteResume` (when the deleted resume was selected) and in `selectResume` (when switching to a different resume) so dependent state resets with its parent.
- `app/resumes/[id]/page.tsx`:
  - Inline `fetchJobs` into its effect with `let cancelled` guard; depend on `[resumeId, userId]`. Keep a `selectJob(null)` call there via a stable reference or move deselection into the same inlined async flow.
  - Wrap the `selectResume(resumeId)` effect so the missing-dep warning is resolved (call through a ref-stable wrapper or list the dep once `selectResume` is stable).
  - Delete the `selectedJobId` reset effect (lines 116-121); do `stopStream()` + reset of `analysisData`, `processStatuses`, `isAnalyzing` inside `handleSelect`, `handleAddJob`, `handleOKAddJob`, and `handleBackToResumes`, which are the only paths that change `selectedJobId`. Add an unmount-only effect returning `stopStream` so the EventSource still closes when leaving the page.
  - Use `isAnalyzing` in the UI: disable the `Analyze →` button and show `Analyzing…` while a run is in flight. This consumes the value instead of deleting state the app already maintains.
- `app/lib/app-store.tsx` (`showError`) and `app/lib/hooks/use-chat.ts`: make `showError` stable with `useCallback` in the provider, then add it to the `use-chat` effect dependency list.
- `app/lib/components/ym/MarkdownPanel.tsx`, `app/lib/components/ym/ChatPanel.tsx`: change `({ node, ...props })` to `({ ...props })` in the five `react-markdown` component overrides. `node` is not read in any of them.

## Data Model and Contracts

No schema, API, or exported-type changes. The `Store` context type is unchanged; `showError` keeps the signature `(message: string) => void`.

## Libraries

- eslint@9 with eslint-config-next (next@16.2.6): flat config, `globalIgnores` from `eslint/config`.
- eslint-plugin-react-hooks v6 (bundled by eslint-config-next): source of `set-state-in-effect` and `exhaustive-deps`.
- react@19.2.4: `useCallback` for stable callback identity.
- react-markdown@10.1.0: `components` prop overrides; `node` is an optional parameter, safe to omit.

## Risks

- **Behavior drift when deleting reset effects**: the reset must fire on every path that changes `selectedResumeId` / `selectedJobId`. Mitigation: enumerate call sites (they are all in these two files) and reset in each; verify by running the app flow (select job → analyze → switch job) after the change.
- **EventSource leak**: removing the `selectedJobId` effect removes the implicit `stopStream()` on unmount. Mitigation: explicit unmount-only cleanup effect.
- **`Analyze →` button now disabled while analyzing**: a visible behavior change. Stated explicitly here for approval; it prevents duplicate concurrent analyze POSTs.
- **No test framework in the repo** (no jest/vitest/playwright test script in package.json). Unit tests cannot be added; verification is `npm run lint` plus `pnpm build`.
