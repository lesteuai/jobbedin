# Plan: Unit tests

Request: unit tests (including React components and hooks)
Status: complete

## Context

`vitest` 4.1.8, `@vitest/coverage-v8` 4.1.8, and `@vitejs/plugin-react` 6.0.2 are already in `devDependencies`, but the project has no vitest config, no test script, and zero test files. The React testing stack is not installed and is added by T1.

This plan covers the pure logic and request-handling branches that carry real risk (encryption, LLM key resolution and error classification, prompt composition, the API error/session wrapper, gibberish detection, route validation and branching) plus the React surface (`ym/` primitives, `AnalysisReport`, `ChatPanel`, the `useChat` hook, and `AppStoreProvider`).

**Layout convention:** tests are colocated with their source. `*.test.ts` files run in the Node environment; `*.test.tsx` files run in jsdom. Shared mocks and render helpers live in `test/`.

**Verified against docs (context7):** Vitest 4 splits environments via `test.projects` with `extends: true` (the older `environmentMatchGlobs` is gone). React Testing Library auto-cleans between tests when `test.globals: true` is set, and jest-dom matchers register via `import '@testing-library/jest-dom/vitest'` in a setup file.

**Out of scope:** `app/lib/db/index.ts`, `app/lib/auth/index.ts`, and `app/api/auth/[...all]/route.ts` are thin third-party wiring. Next.js page components (`app/page.tsx`, `app/settings/page.tsx`, `app/resumes/**`) are route-level compositions best covered by end-to-end tests; the reusable components and hooks they build on are covered here.

## Tasks

### Wave 1

- [x] T1: Vitest harness, React testing stack, and shared test helpers (commit 3c5a123)
  - Files: `vitest.config.ts` (new), `vitest.setup.ts` (new), `vitest.setup.dom.ts` (new), `test/db-mock.ts` (new), `test/next-request.ts` (new), `test/render.tsx` (new), `package.json`, `.gitignore`
  - Do:
    - Install the React testing stack as devDependencies with pnpm: `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`. `@testing-library/dom` is a peer dependency of RTL 16 and must be explicit. React is 19.2.4, so RTL must be v16 or newer.
    - `vitest.config.ts`: use `@vitejs/plugin-react`, `test.globals: true` (RTL relies on it for auto cleanup), and a `resolve.alias` mapping `@` to the project root so `@/app/lib/...` imports resolve. Define two projects via `test.projects`, each with `extends: true`:
      - `{ name: 'node', include: ['app/**/*.test.ts', 'test/**/*.test.ts'], environment: 'node' }`
      - `{ name: 'dom', include: ['app/**/*.test.tsx'], environment: 'jsdom', setupFiles: ['./vitest.setup.ts', './vitest.setup.dom.ts'] }`
      Root-level `setupFiles: ['./vitest.setup.ts']`. Add `test.coverage` with the `v8` provider, `reporter: ['text', 'html']`, and `include: ['app/lib/**', 'app/api/**']`.
    - `vitest.setup.ts`: set the env vars modules read at import time so tests never depend on `.env` — `BETTER_AUTH_SECRET`, `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`.
    - `vitest.setup.dom.ts`: `import '@testing-library/jest-dom/vitest'`, and stub the browser APIs jsdom lacks that these components touch (`window.matchMedia`, `Element.prototype.scrollIntoView`). jsdom does not implement layout, so `scrollHeight` is always 0; note this in a comment since `useChat` writes `scrollTop` from it.
    - `test/db-mock.ts`: export a `createDbMock()` factory returning a chainable drizzle-like stub. It must support the shapes the routes actually use: `db.select().from().where()` / `.orderBy()` awaited as a promise, `db.insert().values().returning()`, `db.insert().values().onConflictDoUpdate()`, `db.delete().where()`, and `db.query.<table>.findFirst()`. Each terminal call resolves to a queued result the test supplies; record every call so tests can assert on arguments. Use `vi.fn()` throughout.
    - `test/next-request.ts`: export `makeRequest(url, init)` returning a real `NextRequest`, and `makeJsonRequest(url, body, init)` for POST/PUT bodies.
    - `test/render.tsx`: export `renderWithStore(ui, options)` that wraps a tree in `AppStoreProvider`, and re-export everything from `@testing-library/react` plus a configured `userEvent`. Keep it thin.
    - `package.json`: add `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.
    - `.gitignore`: ignore `coverage/`.
  - Done when: `pnpm test` runs both projects and reports no failures (no test files yet is acceptable), a scratch `.test.tsx` file can `render(<div />)` and query it without a jsdom error, and `pnpm lint` is clean.

### Wave 2

- [x] T2: Tests for `app/lib/crypto.ts` (commit ecc4d78)
  - Files: `app/lib/crypto.test.ts` (new)
  - Do: cover round-trip `encrypt` → `decrypt` for ASCII, unicode, and empty string; assert the `iv:authTag:ciphertext` hex shape and that two encryptions of the same plaintext differ (random IV); assert `decrypt` throws "Malformed encrypted payload" for payloads with the wrong number of `:` segments; assert `decrypt` throws when the auth tag or ciphertext is tampered with; assert both functions throw "BETTER_AUTH_SECRET is not set" when the env var is absent (delete and restore it inside the test).
  - Done when: all cases pass and no test leaks a mutated `process.env`.

- [x] T3: Tests for `app/lib/openrouter.ts` (commit 66658af, lint fix a691134)
  - Files: `app/lib/openrouter.test.ts` (new)
  - Do: `vi.mock('@langchain/openai')` so `ChatOpenAI` is a spy capturing its constructor config. Assert `createReasoningLlm` uses `temperature: 0`, `maxTokens: 4096`, `frequency_penalty: 0.3`, the OpenRouter `baseURL`, and honors `REASONING_MODEL` with the documented default fallback; same for `createWritingLlm` with `temperature: 0.7` and `WRITING_MODEL`. For key resolution: a valid encrypted key (produced with the real `encrypt`) is decrypted and passed through; a `null`/`undefined`/whitespace-only key falls back to `process.env.OPENROUTER_API_KEY`; an undecryptable key logs an error (spy on `console.error`) and falls back to the server key. Cover `isOutOfCreditError` and `isAuthError` for: matching constructor name plus `status`, matching constructor name plus string/number `code`, wrong constructor name, wrong status, `null`, `undefined`, and primitives.
  - Done when: every branch of `resolveApiKey`, `isOutOfCreditError`, and `isAuthError` is exercised and tests pass.

- [x] T4: Tests for `app/lib/system-prompt.ts` (commit 787e12a)
  - Files: `app/lib/system-prompt.test.ts` (new)
  - Do: assert `generate_letter_prompt()` and `generate_msg_prompt()` return the base prompt unchanged for `undefined`, `null`, `''`, and whitespace-only input; assert non-empty instructions are appended under an `ADDITIONAL USER INSTRUCTIONS:` heading with the instructions trimmed; assert `{` and `}` in custom instructions are escaped to `{{`/`}}` so `ChatPromptTemplate` does not treat them as variables; assert the base prompts are unmodified between calls (no accumulation). Also assert the static prompt exports (`company_prompt`, `cross_reference_prompt`, `feedback_prompt`) are non-empty strings containing their required Markdown section headings.
  - Done when: escaping and append behavior are pinned and tests pass.

- [x] T5: Tests for `app/lib/api-handler.ts` (commit 63c439a)
  - Files: `app/lib/api-handler.test.ts` (new)
  - Do: `vi.mock('@/app/lib/auth')` to control `auth.api.getSession`. Assert each exception class sets the right `name` and default message. For `handleAsync`: pass-through of a successful response; `BadRequestException` → 400 with its message; `UnauthorizedException` → 401; `NotFoundException` → 404; an unknown error → 500 with body `{ error: 'Internal server error' }` and a `console.error` call (spy and silence it). For `handleAsyncAuth`: a valid session is forwarded as the second argument and extra route args (e.g. `{ params }`) are forwarded after it; a `null` session short-circuits to 401 without invoking the wrapped handler. Use `test/next-request.ts` to build requests and assert on parsed JSON bodies and `status`.
  - Done when: every status branch of `withErrorHandling` and both wrappers are covered.

- [x] T6: Export and test the `workflow.ts` pure helpers (commit ca60ccc)
  - Files: `app/lib/workflow.ts`, `app/lib/workflow.test.ts` (new)
  - Do: change `isGibberish` and `resolveStatusReason` in `app/lib/workflow.ts` to named exports. Make no other change to that file. In the test, mock the heavy module graph so importing `workflow.ts` has no side effects: `vi.mock('@/app/lib/db')`, `vi.mock('@langchain/tavily')`, and `vi.mock('@langchain/openai')`. Cover `isGibberish` for: empty and whitespace-only strings (true), normal prose and normal Markdown output (false), a string over 5% replacement/control characters (true), a string under that ratio (false), one character repeated 40+ times (true) and 39 times (false), a 2-4 char sequence repeated 16+ times (true) and 15 times (false). Cover `resolveStatusReason` returning `STATUS_REASON.OUT_OF_CREDIT` for a 402 `APIError`-shaped object, `STATUS_REASON.INVALID_API_KEY` for a 401 `AuthenticationError`-shaped object, and `null` for a plain `Error`, `null`, and `undefined`.
  - Done when: the helpers are exported, all boundary cases pass, and importing the test does not attempt a DB or network connection.
  - Finding: the single-character boundary in the plan above was wrong. A run of one repeated character also satisfies `/(.{2,4})\1{15,}/` once it reaches 32 characters, so `isGibberish` returns true from 32 repeats, not 40. The test asserts the real boundary (31 false, 32 true) rather than the assumed one.

- [x] T7: Tests for `app/lib/constants.ts` (commit 4ecd0e6)
  - Files: `app/lib/constants.test.ts` (new)
  - Do: assert `STATUS_REASON` values are the exact strings `'out_of_credit'` and `'invalid_api_key'` (the API, the DB, and the UI all key off these literals) and that `STATUS_REASON_MESSAGE` has a non-empty message keyed by each `STATUS_REASON` value. Assert a lookup with an unknown key is `undefined`, since `AnalysisReport` and `ChatPanel` depend on that to fall back to their generic message.
  - Done when: the file passes and the literals are pinned.

- [x] T13: Tests for the `ym/` modal and button primitives (commit 3246eb3)
  - Files: `app/lib/components/ym/YmButton.test.tsx` (new), `app/lib/components/ym/YmModal.test.tsx` (new), `app/lib/components/ym/YmErrorModal.test.tsx` (new)
  - Do: `YmButton` — renders children, applies `ym-btn` always and `ym-btn-primary` only for `variant="primary"`, merges a caller-supplied `className`, forwards arbitrary button props (`disabled`, `type`, `aria-label`), and fires `onClick`; a disabled button does not fire. `YmModal` — renders nothing when `open` is false; when open, shows the title (default `JobbedIn` and a custom one), children, and the default `OK`/`Cancel` labels plus custom ones; clicking OK calls `onOk`, clicking Cancel calls `onCancel`, clicking the overlay calls `onCancel`, and clicking inside the window body does NOT call `onCancel` (the `stopPropagation` guard). `YmErrorModal` — same closed/open behavior, renders the message, and both the OK button and the overlay call `onClose` while a click inside the window does not. Use `userEvent` for interactions and query by role and text.
  - Done when: all three files pass and the overlay-vs-body click distinction is asserted.

- [x] T14: Tests for `Sidebar` and `AppFrame` (commit 4e5bb73)
  - Files: `app/lib/components/ym/Sidebar.test.tsx` (new), `app/lib/components/ym/AppFrame.test.tsx` (new)
  - Do: `Sidebar` — renders the title and add label, calls `onAdd` on the add button; shows `(empty)` for an empty item list and hides it when items exist; renders one row per item with its name; clicking a row calls `onSelect` with that id; the delete button (found by its `aria-label`, `Delete <name>`) calls `onDelete` with the id and does NOT also call `onSelect` (the `stopPropagation` guard); the row for `selectedId` has `data-active="true"` and others `false`; optional `header` and `footer` nodes render when supplied. `AppFrame` — `vi.mock('next/navigation')` for `useRouter`/`usePathname`, `vi.mock('@/app/lib/auth/client')` for `authClient.signOut`, and `vi.mock('@/app/lib/app-store')` for `useAppStore` returning a `clearStore` spy. Assert: on `/` the nav button reads `Settings` and routes to `/settings`; on `/settings` it reads `Home` and routes to `/`; children render; `Sign Out` awaits `signOut`, then calls `clearStore`, then pushes `/`.
  - Done when: both files pass and the sign-out ordering is asserted.

- [x] T15: Tests for `MarkdownPanel` (commit fc5ad65)
  - Files: `app/lib/components/ym/MarkdownPanel.test.tsx` (new)
  - Do: assert plain text renders; a `#` heading renders as an `h1` carrying the purple class and an `###` heading as an `h3` with its class; a GFM table renders as a `table` (proving `remark-gfm` is wired); a bullet list renders as a `ul` with the list classes; an empty string renders without throwing. Query by role where possible (`heading`, `table`, `list`). Do not assert on KaTeX output beyond it not throwing on inline math, since that markup is a third-party implementation detail.
  - Done when: the file passes and the remark/rehype plugin wiring is proven by at least the table case.

### Wave 3

- [x] T8: Tests for `app/api/settings/route.ts` (commit d6936c8)
  - Files: `app/api/settings/route.test.ts` (new)
  - Do: mock `@/app/lib/db` with `test/db-mock.ts` and `@/app/lib/auth` for the session. GET: returns stored instructions and `hasOpenrouterApiKey: true` when a row exists; returns `''`/`''`/`false` when no row exists; never returns a raw key field. PUT partial-update matrix, asserting the exact `set` object passed to `onConflictDoUpdate`: instructions only (key untouched); API key only (instructions untouched); `clearOpenrouterApiKey: true` sets `openrouterApiKey: null`; a non-empty `openrouterApiKey` wins over `clearOpenrouterApiKey`; a whitespace-only key counts as absent; an empty body performs no DB write and still returns `{ success: true }`. Assert the stored key is not the plaintext (it goes through `encrypt`) and that `decrypt` of it returns the trimmed input.
  - Done when: every branch of the `updateSet`/`insertValues` construction is asserted, including the no-op path.

- [x] T9: Tests for `app/api/jobs/[id]/chat/route.ts` (commit b9818d2)
  - Files: `app/api/jobs/[id]/chat/route.test.ts` (new)
  - Do: mock `@/app/lib/db`, `@/app/lib/auth`, and `@/app/lib/openrouter` (spy `createWritingLlm` returning an object with an `invoke` mock; keep `isOutOfCreditError` behavior). GET: missing/invalid `mode` → 400; job not owned by the session user → 404; no history row → `{ conversation: [] }`; existing history returned as-is. POST: invalid `mode` → 400; unknown job → 404; neither `userMessage` nor `conversation` → 400; `conversation` that is not an array → 400. Clear path: `conversation: []` deletes then re-inserts and returns `{ success: true }`. AI path: prior history is converted to alternating `HumanMessage`/`AIMessage`, the system prompt includes the JD-match, company, resume, and job-description context sections when those rows exist and omits them when absent, the reply is appended to the conversation, and the response is `{ reply }`. Assert an out-of-credit LLM error returns HTTP 402 with an error message, and any other LLM error propagates to a 500.
  - Done when: all validation branches, both POST paths, and the 402 mapping are covered.

- [x] T10: Tests for `app/api/jobs/[id]/analyze/route.ts` (commit 01b18ce)
  - Files: `app/api/jobs/[id]/analyze/route.test.ts` (new)
  - Do: mock `@/app/lib/db`, `@/app/lib/auth`, and `@/app/lib/workflow` (spy on `runWorkflow`). Cover: job not found → 404; all 5 processes `done` → `{ status: 'done' }` with no workflow start and no deletes; a process in `processing` or `pending` → 202 `{ status: 'started' }` with `runWorkflow` NOT called again and no rows cleared; no in-progress process (all failed, or none exist) → the six stale-data deletes run, exactly 5 process rows are inserted with the documented statuses (Company/JDMatch/ResumeFeedback `processing`, Letter/Message `pending`), `runWorkflow` is called once with the job's resume and job text, and the response is 202. Assert `runWorkflow` receives empty strings when `resume.content` or `job.content` is null.
  - Done when: all four states are covered and the insert payload is asserted precisely.

- [x] T11: Tests for the resume and job CRUD routes (commit ef5b29c)
  - Files: `app/api/jobs/route.test.ts` (new), `app/api/jobs/[id]/route.test.ts` (new), `app/api/resumes/route.test.ts` (new)
  - Do: mock `@/app/lib/db` and `@/app/lib/auth` in each. `app/api/jobs/route.ts`: GET without `resumeId` → 400, with it → the scoped list; POST missing `resumeId` or `content` → 400, valid POST → 201 and the auto-name is `Job N` where N is the existing count plus one (assert `Job 1` for count 0). `app/api/jobs/[id]/route.ts`: GET/DELETE with a missing id → 400, unknown or other-user job → 404, valid GET → the row, valid DELETE → `{ success: true }` after a delete call. `app/api/resumes/route.ts`: POST with no file → 400; `.txt` and `.md` uploads store the decoded text with the extension stripped from the name and return 201 with the new id; an unsupported extension → 400 "Unsupported file type"; a PDF parse failure → 400 "Failed to parse PDF" (mock `pdf-parse` and `pdf-parse/worker`). Build uploads with a real `FormData` and `File`.
  - Done when: all three files pass and every validation branch returns the documented status.

- [x] T16: Tests for `ChatPanel` (commit 826b5a9)
  - Files: `app/lib/components/ym/ChatPanel.test.tsx` (new)
  - Do: render with a full props object built by a local `makeProps(overrides)` helper. Cover `renderMessages` precedence in order: `pending` or `processing` status shows `Generating your cover letter...` in letter mode and `Generating your message...` in message mode; `failed` status with a known `statusReason` shows the matching `STATUS_REASON_MESSAGE` and with an unknown/null reason shows `Generation failed. Please re-analyze.`; a `done` status with no lines and no typing shows the `(No messages yet...)` placeholder; lines render with the `You: ` / `JobbedIn-AI: ` prefixes and their Markdown text; `isAiTyping` appends a `JobbedIn-AI:` row showing `typingDots`. Also assert: the mode buttons call `setMode` with `letter`/`message` and the active one gets `ym-btn-primary`; the textarea placeholder switches with the mode; typing calls `setChatDraft`; pressing `Enter` calls `handleSend` and does not insert a newline, while `Shift+Enter` is not asserted (the component does not special-case it); Send and Clear are disabled per `canSend`/`canClear` and call their handlers when enabled. Note that `getProcessStatus` must return a terminal status for the input-area assertions, since a non-terminal status only changes the message area.
  - Done when: every `renderMessages` branch and the mode/send/clear interactions pass.

- [x] T17: Tests for `AnalysisReport` (commit d60f2a7)
  - Files: `app/lib/components/AnalysisReport.test.tsx` (new)
  - Do: `vi.mock('@/app/lib/components/ym/ChatPanel')` with a marker element so this test targets `AnalysisReport`'s own branching rather than re-testing T16. Build props with a local helper; drive `getProcessStatus`/`getProcessReason` from a plain record. Cover: the header shows `Analysis: <selectedName>`; `← Back to Job` calls `onBack`; all four tabs render, the active one has `data-active="true"`, and clicking one calls `setTab` with its name. Content branches for Company/JDMatch/Feedback: `done` with content renders the markdown; `done` with null content falls through to `Processing...`; `failed` with a known reason shows the mapped message and with an unknown reason shows `Analysis failed for this section.`; any other status shows `Processing...`. Generate tab: both statuses null shows `Generation failed for this section.`; either status `pending`/`processing` shows `Generating...`; either `failed` shows the mapped message for the failed process type, preferring Letter when both failed; both `done` renders the mocked `ChatPanel`.
  - Done when: every branch of `renderTabContent` is covered.

### Wave 4

- [x] T18: Tests for the `useChat` hook (commit 101c20a)
  - Files: `app/lib/hooks/use-chat.test.tsx` (new)
  - Do: use `renderHook` from RTL. `vi.mock('@/app/lib/app-store')` so `useAppStore` returns a `showError` spy. Stub `global.fetch` with `vi.fn()` per test and use fake timers for the typing-dots interval. Cover: initial state (`mode` is `message`, both chat lists empty, `chatsLoaded` false); the load effect does not fetch when `tab` is not `Generate` or `selectedJobId` is null; on `tab === 'Generate'` with an id it fetches both the letter and message histories, populates `chats`, and sets `chatsLoaded`; a non-ok response calls `showError` and leaves `chatsLoaded` false. `canSend` is false for an empty or whitespace draft and true for a non-empty one; `canClear` follows the current mode's line count. `handleSend`: optimistically appends the user line and clears the draft, POSTs `{ mode, userMessage }`, appends the AI reply on success, and on failure calls `showError` with the server's `error` message, restores the draft, and removes the optimistic line. `handleClear`: empties the current mode's lines and the draft, and POSTs `{ mode, conversation: [] }`; a rejected fetch is swallowed without calling `showError`. Also assert the typing dots cycle `.` → `..` → `...` → `.` on 400ms ticks while `isAiTyping` and stop after it clears.
  - Done when: the load, send, clear, and typing-dot behaviors all pass with no unhandled promise rejections.

- [x] T19: Tests for `AppStoreProvider` and `apiErrorMessage` (commit d4cc342)
  - Files: `app/lib/app-store.test.tsx` (new)
  - Do: `vi.mock('@/app/lib/auth/client')` so `useSession` returns a controllable value. Test `apiErrorMessage` directly: a JSON body with `error` returns it; JSON without `error` returns the fallback; a body whose `json()` rejects returns the fallback. Then use `renderHook` with `AppStoreProvider` as the wrapper and a stubbed `global.fetch`. Cover: `useAppStore` outside the provider throws `useAppStore must be inside AppStoreProvider`; with a session, resumes are fetched on mount and a failed fetch surfaces the error modal text; `addJob` throws `No resume selected` when none is selected, and on success POSTs the selected `resumeId` plus content and appends the returned job; `deleteResume`/`deleteJob` remove the item and null out the selection when the deleted id was selected, and on a non-ok response call `showError` and rethrow; `selectResume`/`selectJob` skip the fetch when the item is already loaded with content and otherwise fetch and merge it; `selectJob(null)` clears the selection without fetching; `clearStore` empties everything; `showError` renders `YmErrorModal` and its OK button dismisses it.
  - Done when: every store action's success and failure path is covered and the error modal round-trip passes.

### Wave 5

- [x] T12: README testing section and full-suite verification (commit fa13546)
  - Files: `README.md`
  - Do: add a short "Testing" section documenting `pnpm test`, `pnpm test:watch`, and `pnpm test:coverage`, and stating the layout convention: tests are colocated, `*.test.ts` runs in Node and `*.test.tsx` in jsdom, with shared mocks and render helpers in `test/`. Match the existing README tone and heading style. Then run the full suite and `pnpm lint` and report the result.
  - Done when: the section renders correctly, the commands match `package.json`, and the whole suite passes.

## Code Review (medium)

Reviewed by mutation testing: source invariants were deliberately broken and the suite re-run to confirm the tests fail. Caught correctly on the first pass were the settings partial-update guarantee, the `isGibberish` bad-character threshold, the `NotFoundException` status mapping, the analyze route's initial process statuses, the `AnalysisReport` letter-over-message failure preference, the `useChat` optimistic-line rollback, and the `AppStore` selection reset on delete.

- `app/api/jobs/route.test.ts:49`, `app/api/resumes/route.test.ts:59` — user-scoping was never actually verified. Both tests named user scoping in their titles but asserted only `expect(where[0]).toBeDefined()`, which passes for any where clause. Deleting `eq(resumeJob.userId, session.user.id)` from the jobs GET query, a cross-user data leak, failed no test.
  - Fixed in commit 04bdf44. Added `equalityComparisons()` to `test/db-mock.ts`, which flattens a drizzle where clause into the column/value pairs it filters on, and asserted the real scoping in the jobs list, resumes list, job detail, and settings reads. Re-ran the mutation across all four routes: each now fails.

No other findings. No `.skip`/`.only`/`.todo`, no `any` casts, and no suppressed lint rules in the test sources.

## Scope Gap Found After Review

Running coverage surfaced three API routes this plan never listed, in either the task list or the out-of-scope section: `app/api/resumes/[id]/route.ts`, `app/api/jobs/[id]/analysis/route.ts`, and `app/api/jobs/[id]/analysis-stream/route.ts`. All three sat at 0 percent. Their omission was an oversight in the plan rather than a deliberate exclusion, so I covered them.

- [x] T20: Tests for the resume detail, analysis snapshot, and analysis SSE stream routes (commit 9f69d2f)
  - Files: `app/api/resumes/[id]/route.test.ts`, `app/api/jobs/[id]/analysis/route.test.ts`, `app/api/jobs/[id]/analysis-stream/route.test.ts`
  - The SSE test reads decoded chunks off the stream reader and asserts the immediate first poll, the 1000ms interval poll, terminal close, and the error chunk. `analysis-stream/route.ts` enqueues plain strings rather than encoded bytes, so no `TextDecoder` is involved.

Coverage over `app/lib/**` and `app/api/**` moved from 72.34 to 80.24 percent of statements, and from 77.20 to 89.06 percent of branches.
