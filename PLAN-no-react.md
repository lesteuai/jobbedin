# Plan: Unit tests

Request: unit tests
Status: draft

## Context

`vitest` 4.1.8, `@vitest/coverage-v8` 4.1.8, and `@vitejs/plugin-react` 6.0.2 are already in `devDependencies`, but the project has no vitest config, no test script, and zero test files. This plan adds the test harness and covers the pure logic and request-handling branches that carry real risk: encryption, LLM key resolution and error classification, prompt composition, the API error/session wrapper, gibberish detection, and the validation/branching logic in the API routes.

Test files live next to their source as `*.test.ts` (colocated, matching the project's "related things collocated" convention). Shared mocks live in `test/`.

**Out of scope:** React component and hook rendering tests. `@testing-library/react` and a jsdom environment are not installed, and adding them is a separate decision. `useChat`, `AppStore` rendering, and the `ym/` components are therefore untested here. `app/lib/db/index.ts`, `app/lib/auth/index.ts`, and `app/api/auth/[...all]/route.ts` are thin third-party wiring and are also excluded.

## Tasks

### Wave 1

- [ ] T1: Vitest harness and shared test helpers
  - Files: `vitest.config.ts` (new), `vitest.setup.ts` (new), `test/db-mock.ts` (new), `test/next-request.ts` (new), `package.json`, `.gitignore`
  - Do:
    - `vitest.config.ts`: use `@vitejs/plugin-react`, `test.environment: 'node'`, `test.globals: true`, `setupFiles: ['./vitest.setup.ts']`, `include: ['app/**/*.test.{ts,tsx}', 'test/**/*.test.ts']`, and a `resolve.alias` mapping `@` to the project root so `@/app/lib/...` imports resolve. Add `test.coverage` with the `v8` provider, `reporter: ['text', 'html']`, and `include: ['app/lib/**', 'app/api/**']`.
    - `vitest.setup.ts`: set the env vars modules read at import time so tests never depend on `.env` — `BETTER_AUTH_SECRET`, `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`.
    - `test/db-mock.ts`: export a `createDbMock()` factory returning a chainable drizzle-like stub. It must support the shapes the routes actually use: `db.select().from().where()` / `.orderBy()` awaited as a promise, `db.insert().values().returning()`, `db.insert().values().onConflictDoUpdate()`, `db.delete().where()`, and `db.query.<table>.findFirst()`. Each terminal call resolves to a queued result the test supplies; record every call so tests can assert on arguments. Use `vi.fn()` throughout.
    - `test/next-request.ts`: export `makeRequest(url, init)` returning a real `NextRequest`, and `makeJsonRequest(url, body, init)` for POST/PUT bodies.
    - `package.json`: add `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.
    - `.gitignore`: ignore `coverage/`.
  - Done when: `pnpm test` runs and reports "no test files found" (or passes) without a config or alias error, and `pnpm lint` is clean.

### Wave 2

- [ ] T2: Tests for `app/lib/crypto.ts`
  - Files: `app/lib/crypto.test.ts` (new)
  - Do: cover round-trip `encrypt` → `decrypt` for ASCII, unicode, and empty string; assert the `iv:authTag:ciphertext` hex shape and that two encryptions of the same plaintext differ (random IV); assert `decrypt` throws "Malformed encrypted payload" for payloads with the wrong number of `:` segments; assert `decrypt` throws when the auth tag or ciphertext is tampered with; assert both functions throw "BETTER_AUTH_SECRET is not set" when the env var is absent (delete and restore it inside the test).
  - Done when: all cases pass and no test leaks a mutated `process.env`.

- [ ] T3: Tests for `app/lib/openrouter.ts`
  - Files: `app/lib/openrouter.test.ts` (new)
  - Do: `vi.mock('@langchain/openai')` so `ChatOpenAI` is a spy capturing its constructor config. Assert `createReasoningLlm` uses `temperature: 0`, `maxTokens: 4096`, `frequency_penalty: 0.3`, the OpenRouter `baseURL`, and honors `REASONING_MODEL` with the documented default fallback; same for `createWritingLlm` with `temperature: 0.7` and `WRITING_MODEL`. For key resolution: a valid encrypted key (produced with the real `encrypt`) is decrypted and passed through; a `null`/`undefined`/whitespace-only key falls back to `process.env.OPENROUTER_API_KEY`; an undecryptable key logs an error (spy on `console.error`) and falls back to the server key. Cover `isOutOfCreditError` and `isAuthError` for: matching constructor name plus `status`, matching constructor name plus string/number `code`, wrong constructor name, wrong status, `null`, `undefined`, and primitives.
  - Done when: every branch of `resolveApiKey`, `isOutOfCreditError`, and `isAuthError` is exercised and tests pass.

- [ ] T4: Tests for `app/lib/system-prompt.ts`
  - Files: `app/lib/system-prompt.test.ts` (new)
  - Do: assert `generate_letter_prompt()` and `generate_msg_prompt()` return the base prompt unchanged for `undefined`, `null`, `''`, and whitespace-only input; assert non-empty instructions are appended under an `ADDITIONAL USER INSTRUCTIONS:` heading with the instructions trimmed; assert `{` and `}` in custom instructions are escaped to `{{`/`}}` so `ChatPromptTemplate` does not treat them as variables; assert the base prompts are unmodified between calls (no accumulation). Also assert the static prompt exports (`company_prompt`, `cross_reference_prompt`, `feedback_prompt`) are non-empty strings containing their required Markdown section headings.
  - Done when: escaping and append behavior are pinned and tests pass.

- [ ] T5: Tests for `app/lib/api-handler.ts`
  - Files: `app/lib/api-handler.test.ts` (new)
  - Do: `vi.mock('@/app/lib/auth')` to control `auth.api.getSession`. Assert each exception class sets the right `name` and default message. For `handleAsync`: pass-through of a successful response; `BadRequestException` → 400 with its message; `UnauthorizedException` → 401; `NotFoundException` → 404; an unknown error → 500 with body `{ error: 'Internal server error' }` and a `console.error` call (spy and silence it). For `handleAsyncAuth`: a valid session is forwarded as the second argument and extra route args (e.g. `{ params }`) are forwarded after it; a `null` session short-circuits to 401 without invoking the wrapped handler. Use `test/next-request.ts` to build requests and assert on parsed JSON bodies and `status`.
  - Done when: every status branch of `withErrorHandling` and both wrappers are covered.

- [ ] T6: Export and test the `workflow.ts` pure helpers
  - Files: `app/lib/workflow.ts`, `app/lib/workflow.test.ts` (new)
  - Do: change `isGibberish` and `resolveStatusReason` in `app/lib/workflow.ts` to named exports. Make no other change to that file. In the test, mock the heavy module graph so importing `workflow.ts` has no side effects: `vi.mock('@/app/lib/db')`, `vi.mock('@langchain/tavily')`, and `vi.mock('@langchain/openai')`. Cover `isGibberish` for: empty and whitespace-only strings (true), normal prose and normal Markdown output (false), a string over 5% replacement/control characters (true), a string under that ratio (false), one character repeated 40+ times (true) and 39 times (false), a 2-4 char sequence repeated 16+ times (true) and 15 times (false). Cover `resolveStatusReason` returning `STATUS_REASON.OUT_OF_CREDIT` for a 402 `APIError`-shaped object, `STATUS_REASON.INVALID_API_KEY` for a 401 `AuthenticationError`-shaped object, and `null` for a plain `Error`, `null`, and `undefined`.
  - Done when: the helpers are exported, all boundary cases pass, and importing the test does not attempt a DB or network connection.

- [ ] T7: Tests for `app/lib/constants.ts` and `apiErrorMessage`
  - Files: `app/lib/constants.test.ts` (new), `app/lib/app-store.test.tsx` (new)
  - Do: for constants, assert `STATUS_REASON` values are the exact strings `'out_of_credit'` and `'invalid_api_key'` (the API and DB depend on these literals) and that `STATUS_REASON_MESSAGE` has a non-empty message keyed by each `STATUS_REASON` value. For `apiErrorMessage` (exported from `app/lib/app-store.tsx`), mock `@/app/lib/auth/client` and `@/app/lib/components/ym/YmErrorModal` so the module imports cleanly, then assert: a response whose JSON has `error` returns that message; JSON without `error` returns the fallback; a response whose `json()` rejects (non-JSON body) returns the fallback. Build responses with `new Response(...)`.
  - Done when: both files pass without rendering any React component.

### Wave 3

- [ ] T8: Tests for `app/api/settings/route.ts`
  - Files: `app/api/settings/route.test.ts` (new)
  - Do: mock `@/app/lib/db` with `test/db-mock.ts` and `@/app/lib/auth` for the session. GET: returns stored instructions and `hasOpenrouterApiKey: true` when a row exists; returns `''`/`''`/`false` when no row exists; never returns a raw key field. PUT partial-update matrix, asserting the exact `set` object passed to `onConflictDoUpdate`: instructions only (key untouched); API key only (instructions untouched); `clearOpenrouterApiKey: true` sets `openrouterApiKey: null`; a non-empty `openrouterApiKey` wins over `clearOpenrouterApiKey`; a whitespace-only key counts as absent; an empty body performs no DB write and still returns `{ success: true }`. Assert the stored key is not the plaintext (it goes through `encrypt`) and that `decrypt` of it returns the trimmed input.
  - Done when: every branch of the `updateSet`/`insertValues` construction is asserted, including the no-op path.

- [ ] T9: Tests for `app/api/jobs/[id]/chat/route.ts`
  - Files: `app/api/jobs/[id]/chat/route.test.ts` (new)
  - Do: mock `@/app/lib/db`, `@/app/lib/auth`, and `@/app/lib/openrouter` (spy `createWritingLlm` returning an object with an `invoke` mock; keep `isOutOfCreditError` behavior). GET: missing/invalid `mode` → 400; job not owned by the session user → 404; no history row → `{ conversation: [] }`; existing history returned as-is. POST: invalid `mode` → 400; unknown job → 404; neither `userMessage` nor `conversation` → 400; `conversation` that is not an array → 400. Clear path: `conversation: []` deletes then re-inserts and returns `{ success: true }`. AI path: prior history is converted to alternating `HumanMessage`/`AIMessage`, the system prompt includes the JD-match, company, resume, and job-description context sections when those rows exist and omits them when absent, the reply is appended to the conversation, and the response is `{ reply }`. Assert an out-of-credit LLM error returns HTTP 402 with an error message, and any other LLM error propagates to a 500.
  - Done when: all validation branches, both POST paths, and the 402 mapping are covered.

- [ ] T10: Tests for `app/api/jobs/[id]/analyze/route.ts`
  - Files: `app/api/jobs/[id]/analyze/route.test.ts` (new)
  - Do: mock `@/app/lib/db`, `@/app/lib/auth`, and `@/app/lib/workflow` (spy on `runWorkflow`). Cover: job not found → 404; all 5 processes `done` → `{ status: 'done' }` with no workflow start and no deletes; a process in `processing` or `pending` → 202 `{ status: 'started' }` with `runWorkflow` NOT called again and no rows cleared; no in-progress process (all failed, or none exist) → the six stale-data deletes run, exactly 5 process rows are inserted with the documented statuses (Company/JDMatch/ResumeFeedback `processing`, Letter/Message `pending`), `runWorkflow` is called once with the job's resume and job text, and the response is 202. Assert `runWorkflow` receives empty strings when `resume.content` or `job.content` is null.
  - Done when: all four states are covered and the insert payload is asserted precisely.

- [ ] T11: Tests for the resume and job CRUD routes
  - Files: `app/api/jobs/route.test.ts` (new), `app/api/jobs/[id]/route.test.ts` (new), `app/api/resumes/route.test.ts` (new)
  - Do: mock `@/app/lib/db` and `@/app/lib/auth` in each. `app/api/jobs/route.ts`: GET without `resumeId` → 400, with it → the scoped list; POST missing `resumeId` or `content` → 400, valid POST → 201 and the auto-name is `Job N` where N is the existing count plus one (assert `Job 1` for count 0). `app/api/jobs/[id]/route.ts`: GET/DELETE with a missing id → 400, unknown or other-user job → 404, valid GET → the row, valid DELETE → `{ success: true }` after a delete call. `app/api/resumes/route.ts`: POST with no file → 400; `.txt` and `.md` uploads store the decoded text with the extension stripped from the name and return 201 with the new id; an unsupported extension → 400 "Unsupported file type"; a PDF parse failure → 400 "Failed to parse PDF" (mock `pdf-parse` and `pdf-parse/worker`). Build uploads with a real `FormData` and `File`.
  - Done when: all three files pass and every validation branch returns the documented status.

### Wave 4

- [ ] T12: README/test-docs note and coverage sanity check
  - Files: `README.md`
  - Do: add a short "Testing" section documenting `pnpm test`, `pnpm test:watch`, and `pnpm test:coverage`, and stating that tests are colocated as `*.test.ts` with shared mocks in `test/`. Match the existing README tone and heading style.
  - Done when: the section renders correctly and the commands listed match `package.json`.
