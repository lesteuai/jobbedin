# Test Report

Run: `npm run test:coverage`

## Summary

- Test Files: 25 passed (25)
- Tests: 362 passed (362)
- Duration: 6.31s

## Coverage Summary

- Statements: 80.24% (650/810)
- Branches: 89.06% (383/430)
- Functions: 66.66% (122/183)
- Lines: 80.18% (595/742)

## Coverage by File

| File | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s |
|---|---|---|---|---|---|
| api/auth/[...all]/route.ts | 0 | 100 | 100 | 0 | 4 |
| .../analysis-stream/route.ts | 94.73 | 79.41 | 85.71 | 96.96 | 84 |
| .../jobs/[id]/analyze/route.ts | 94.44 | 92.85 | 100 | 94.44 | 25 |
| .../jobs/[id]/chat/route.ts | 92.85 | 93.75 | 100 | 92.85 | 27, 65, 123-126 |
| api/resumes/route.ts | 100 | 90 | 100 | 100 | 36 |
| lib/app-store.tsx | 99.15 | 95.45 | 96.15 | 99 | 85 |
| lib/email.ts | 0 | 0 | 0 | 0 | 3-50 |
| lib/workflow.ts | 19.6 | 63.63 | 20 | 14.58 | 74-83, 111-438 |
| lib/auth/index.ts | 0 | 0 | 0 | 28.57 | 7-48 |
| lib/components/AnalysisReport.tsx | 100 | 96.55 | 100 | 100 | 60 |
| lib/db/index.ts | 0 | 0 | 100 | 0 | 5-12 |
| lib/db/schema.ts | 43.9 | 100 | 4.16 | 51.42 | 93-202, 209-215 |
| lib/hooks/use-chat.ts | 98.7 | 94.11 | 100 | 98.43 | 64 |

## Column Definitions

- **% Stmts** — percentage of executable statements run during tests
- **% Branch** — percentage of conditional branches (if/else, ternaries, `&&`) exercised
- **% Funcs** — percentage of defined functions actually called
- **% Lines** — percentage of source lines executed
- **Uncovered Line #s** — specific line numbers never hit by any test

## Per-File Explanations

- **api/auth/[...all]/route.ts (0%)** — the better-auth catch-all handler isn't exercised at all; it likely delegates to the auth library and is tested indirectly elsewhere or not unit-tested.
- **analysis-stream/route.ts (94.73% stmts)** — near-complete SSE route coverage, one uncovered line (84).
- **jobs/[id]/analyze/route.ts (94.44% stmts)** — one uncovered line (25).
- **jobs/[id]/chat/route.ts (92.85% stmts)** — lines 27, 65, 123-126 uncovered, likely an error-handling branch.
- **api/resumes/route.ts (100% stmts, 90% branch)** — one conditional path (line 36) untested.
- **lib/app-store.tsx (99.15% stmts)** — near-complete, line 85 uncovered.
- **lib/email.ts (0%)** — entirely untested (lines 3-50).
- **lib/workflow.ts (19.6% stmts, 14.58% lines)** — the LangGraph workflow logic is largely untested; lines 74-83 and 111-438 (the bulk of the file) aren't covered. This is consistent with the file containing complex async/LLM-driven logic.
- **lib/auth/index.ts (0%)** — better-auth configuration untested.
- **lib/components/AnalysisReport.tsx (100% stmts, 96.55% branch)** — nearly complete.
- **lib/db/index.ts (0%)** — DB client setup untested.
- **lib/db/schema.ts (43.9% stmts, 4.16% funcs)** — schema definitions mostly untested, expected since schemas are largely declarative.
- **lib/hooks/use-chat.ts (98.7% stmts)** — line 64 uncovered.

## Notes

- Core business logic (API routes, hooks, components, app-store) has strong coverage (90-100%).
- Untested infrastructure/config wrappers: `lib/auth/index.ts` (better-auth config), `lib/db/index.ts` (DB client setup), `lib/email.ts` (email sending).
- `lib/workflow.ts` has the lowest coverage. It defines the LangGraph node logic that calls external LLMs and Tavily search, which is harder to exercise in unit tests and likely relies on integration or manual testing instead.
- `lib/db/schema.ts` has low function coverage, expected for a largely declarative Drizzle schema file.
