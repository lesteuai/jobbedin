# Unit Testing & Vitest

## Harness

Vitest runs the suite as two projects split by file extension. `vitest.config.ts` declares both with `extends: true`, so each inherits the root alias, setup file, and coverage settings.

| Project | Include | Environment | Setup files |
|---------|---------|-------------|-------------|
| `node` | `app/**/*.test.ts`, `test/**/*.test.ts` | `node` | `vitest.setup.ts` |
| `dom` | `app/**/*.test.tsx` | `jsdom` | `vitest.setup.ts`, `vitest.setup.dom.ts` |

The extension decides the environment. Name a test `.test.tsx` only when it renders React; everything else is `.test.ts`.

`test.globals: true` is set at the root. React Testing Library reads that flag to register its automatic `cleanup()` between tests, so leaving it enabled is load-bearing. `resolve.alias` maps `@` to the project root, matching the `@/*` path in `tsconfig.json`.

Vitest 4 removed `environmentMatchGlobs`. `test.projects` is the supported way to run more than one environment from a single config.

**Commands:**
```bash
pnpm test           # Run both projects once
pnpm test:watch     # Re-run on change
pnpm test:coverage  # v8 provider, text and html reporters
```

Coverage is scoped to `app/lib/**` and `app/api/**`.

## Setup files

`vitest.setup.ts` assigns the env vars that modules read at import time: `BETTER_AUTH_SECRET`, `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE`, `OPENROUTER_API_KEY`, and `TAVILY_API_KEY`. All are fake values. This is what lets the suite run with no `.env` present. `app/lib/db/index.ts` throws at import time when the PG vars are missing, so any test that transitively imports it depends on this file.

`vitest.setup.dom.ts` imports `@testing-library/jest-dom/vitest` for the DOM matchers and stubs `window.matchMedia` and `Element.prototype.scrollIntoView`, neither of which jsdom implements.

## Layout convention

Test files sit next to the code they cover.

```
app/lib/
├── crypto.ts
├── crypto.test.ts
├── workflow.ts
└── workflow.test.ts

app/api/settings/
├── route.ts
└── route.test.ts
```

`test/` holds shared mocks and helpers only, never test cases.

## Shared helpers

### test/db-mock.ts

`createDbMock()` returns a chainable Drizzle stub. It covers exactly the call shapes the routes use:

- `db.select(...).from(...).where(...)` and `.orderBy(...)`, awaited directly
- `db.insert(table).values(v).returning(...)` and `.onConflictDoUpdate({...})`
- `db.delete(table).where(...)`
- `db.query.<table>.findFirst({...})`

Terminal calls resolve to values queued in advance. `db.queueResult(v)` feeds the shared select/insert/delete queue in call order; `db.query.<table>.queueResult(v)` feeds a per-table queue for `findFirst`.

Every call is recorded for assertion:

| Array | Shape |
|-------|-------|
| `db.calls.select` | `{ select, from, where, orderBy }` |
| `db.calls.insert` | `{ table, values, returning, onConflictDoUpdate }` |
| `db.calls.delete` | `{ table, where }` |

Each field holds the argument list passed to that method, so `db.calls.insert[0].values[0]` is the first argument to `.values()`.

There is no `reset()`. Tests that reuse one mock across cases clear the arrays themselves:

```typescript
beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
});
```

Wire it in with a hoisted mock:

```typescript
const dbMock = createDbMock();
vi.mock('@/app/lib/db', () => ({ db: dbMock }));
```

**`equalityComparisons(clause)`** flattens a Drizzle where clause into the `{ column, value }` pairs it filters on, where `column` is the database column name as a string. Drizzle builds `eq(col, val)` as a nested SQL object holding a Column chunk followed by a Param chunk, so walking the chunks depth first and pairing each column with the next param recovers the real filter.

```typescript
const comparisons = equalityComparisons(dbMock.calls.select.at(-1)?.where[0]);
expect(comparisons).toContainEqual({ column: 'resume_id', value: 'r1' });
expect(comparisons).toContainEqual({ column: 'user_id', value: 'user-1' });
```

This helper exists because a where clause is otherwise opaque. Asserting `expect(where[0]).toBeDefined()` passes even after the userId filter is deleted from the query, which is the cross-user leak the assertion is supposed to catch. Assert the columns, not the existence of a clause.

### test/next-request.ts

`makeRequest(url, init)` and `makeJsonRequest(url, body, init)` build real `NextRequest` objects. Use absolute URLs, because the 500 branch in `handleAsync` reads `request.nextUrl.pathname`:

```typescript
const request = makeJsonRequest('http://localhost:3000/api/settings', { customLetterInstructions: 'x' }, { method: 'PUT' });
const response = await PUT(request);
```

Route handlers taking a dynamic segment receive the params promise as their next argument:

```typescript
await GET(makeRequest(JOB_URL), { params: Promise.resolve({ id: 'job-1' }) });
```

### test/render.tsx

Re-exports everything from `@testing-library/react` plus `userEvent`, and adds `renderWithStore(ui, options)`, which wraps the tree in `AppStoreProvider` and returns a `user` alongside the usual render result. Components with no store dependency import from `@testing-library/react` directly.

## What is covered

- `app/lib/crypto.ts`: round trip, payload shape, tampering, missing secret
- `app/lib/openrouter.ts`: factory config, user key decryption and server fallback, 401/402 classification
- `app/lib/system-prompt.ts`: custom instruction append, trimming, `{}` escaping for `ChatPromptTemplate`
- `app/lib/api-handler.ts`: every status branch of both wrappers
- `app/lib/workflow.ts`: the exported `isGibberish` and `resolveStatusReason` helpers only; the LangGraph nodes are not exercised
- `app/lib/constants.ts`: the status reason literals and message map
- `app/api/settings/route.ts`: the full partial-update matrix and key encryption
- `app/api/jobs/[id]/chat/route.ts`: validation, both POST paths, the 402 mapping
- `app/api/jobs/[id]/analyze/route.ts`: the done, in-progress, and restart states
- `app/api/jobs/[id]/analysis/route.ts`: the snapshot response shape and null relations
- `app/api/jobs/[id]/analysis-stream/route.ts`: SSE headers, the immediate first poll, the interval poll, terminal close, and the error chunk
- `app/api/jobs/route.ts`, `app/api/jobs/[id]/route.ts`, `app/api/resumes/route.ts`, `app/api/resumes/[id]/route.ts`: CRUD validation branches
- `app/lib/components/ym/`: `YmButton`, `YmModal`, `YmErrorModal`, `Sidebar`, `AppFrame`, `MarkdownPanel`, `ChatPanel`
- `app/lib/components/AnalysisReport.tsx`: every branch of `renderTabContent`
- `app/lib/hooks/use-chat.ts`: load, send, clear, typing dots
- `app/lib/app-store.tsx`: every store action and the error modal round trip

**Deliberately not covered:**
- `app/lib/db/index.ts` and `app/lib/auth/index.ts`: third-party client wiring
- `app/api/auth/[...all]/route.ts`: the better-auth handler
- `app/lib/email.ts`: nodemailer transport wiring
- The LangGraph node bodies in `app/lib/workflow.ts`: they orchestrate live LLM and database calls
- Page components under `app/page.tsx`, `app/settings/`, and `app/resumes/`: route-level compositions

The project has no end-to-end suite. Anything listed here as uncovered is uncovered, not covered elsewhere.

## Notable details

**`isGibberish` trips at 32 repeated characters, not 40.** The `/(.)\1{39,}/` regex suggests 40, but a 32-character run also satisfies `/(.{2,4})\1{15,}/` as "aa" repeated 16 times. `workflow.test.ts` pins the real boundary.

**Error classification keys off the constructor name.** `isOutOfCreditError` and `isAuthError` check `error.constructor.name` against `APIError` and `AuthenticationError`. Build fixtures with real named classes (`class APIError extends Error {}`); a plain object with a spoofed `constructor` property will not match.

**jsdom has no layout engine.** `scrollHeight`, `clientHeight`, and `scrollTop` always read 0. The `useChat` scroll effect runs without throwing, but its result cannot be asserted.

**Mock `ChatPanel` when testing `AnalysisReport`.** `AnalysisReport.test.tsx` replaces it with a marker element so the test targets tab branching rather than repeating `ChatPanel.test.tsx`.

**The SSE stream enqueues strings, not bytes.** `analysis-stream/route.ts` calls `controller.enqueue` with a plain `data: ...\n\n` string rather than encoding to a `Uint8Array`, so its test reads chunks straight off the reader with no `TextDecoder`. Advance the 1000ms poll interval with `vi.advanceTimersByTimeAsync`, and start reading the next chunk before advancing so the read is pending when the poll fires.

## Adding a test

1. Create `<module>.test.ts`, or `<component>.test.tsx` when it renders React, next to the source.
2. For routes, mock `@/app/lib/db` with `createDbMock()` and `@/app/lib/auth` for the session, then build requests with `test/next-request.ts`.
3. For components, render with `renderWithStore()` when the tree needs store context, and query by role.
4. Assert the values a query filters on with `equalityComparisons`, not the presence of a clause.
5. Run `pnpm test:watch` while working, then `pnpm test` and `pnpm lint` before committing.
