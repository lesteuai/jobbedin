# Gotchas & Troubleshooting

## Route Protection

**No middleware route protection.** Removed in commit 540145d.

Pages like `/resumes` and `/jobs` are publicly accessible but fail to load data if session is missing (API returns 401).

**To re-add server-side protection:** Implement `middleware.ts` checking session before allowing access.

## API Error Handling

All API routes use `handleAsync` wrapper from `app/lib/api-handler.ts`:

```typescript
export const GET = handleAsync(async (request, ctx) => {
  // Handler code; unhandled throws caught globally
  return new Response(JSON.stringify(data), { status: 200 });
});
```

**Wrapper logs:** `[METHOD] /path error: ${message}` to server console

**Returns:** 500 JSON error response for unhandled throws

**Intentional errors:** Still returned explicitly inside handler (401, 400, 404)

## Session Validation (Critical)

**Every API route must validate before querying:**
```typescript
const session = await auth.api.getSession({ headers: request.headers });
if (\!session) return new Response('Unauthorized', { status: 401 });
```

**Missing validation:** Route vulnerable to unauthenticated access

**Missing userId scoping:** Cross-user data leaks

Always use: `eq(table.userId, session.user.id)` in queries

## PDF Parsing Failures

pdf-parse can fail on:
- Encrypted PDFs
- Malformed files
- Large files (may timeout)

**Current behavior:** Returns 400 on failure, no retry or fallback

**Production consideration:** Implement chunked processing for large PDFs

## File Naming Issues

Resume files stored by name (without extension). Duplicate names create separate entries:
- Same name, different UUID
- No uniqueness enforcement

**Recommendation:** Enforce unique names per user or append timestamp

## Better-auth Session Management

**Cookie behavior:**
- better-auth sets cookies automatically
- `authClient.signOut()` clears cookies on client
- Does NOT invalidate database record

**Source of truth:** expiresAt timestamp (not cookie presence)

**Expired sessions:** Still present in database until manually deleted

## Environment Variables

**No validation on startup.** Missing vars crash during module import.

**PostgreSQL vars (required):**
- PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE

**better-auth vars (required):**
- BETTER_AUTH_SECRET, ORIGIN, ORIGIN_DEV

**Workflow vars:**
- OPENROUTER_API_KEY (required for LLM nodes)
- TAVILY_API_KEY (required for company research)
- REASONING_MODEL, WRITING_MODEL (optional; defaults to meta-llama/llama-3.1-8b-instruct:free)

**Failure mode:** App crashes on import if required vars missing

## LangGraph Workflow Issues

### Missing API Keys

**OPENROUTER_API_KEY missing:** All LLM nodes fail silently
- Process status set to Failed
- Error only logged to server console
- Frontend sees Failed status on next poll

**TAVILY_API_KEY missing:** ResearchCompany node fails
- Same silent failure pattern

### Fire-and-Forget Execution

`/api/jobs/[id]/analyze` calls `void runWorkflow()` without awaiting:
- Returns 202 immediately
- Workflow executes in background
- No error handling beyond logging

**If workflow crashes:**
- Frontend sees process status "Failed"
- Error only logged to server console, not returned to client

### Per-Node Status Tracking

Each node independently updates its own process record:
- Multiple nodes can fail independently
- No aggregated error summary
- No retry mechanism at node level
- Frontend displays per-node status, not aggregated errors

## Job Lazy-Loading

`selectJob(id)` now lazy-loads full job content:
- Checks if content field present (not yet loaded)
- Fetches from API if missing
- Skips fetch on subsequent calls (prevents redundant API calls)

**Error handling:**
- If fetch fails, throws after calling `showError()`
- Callers (like handleSelect) catch exception
- Failed fetch keeps current view; doesn't switch

## TypeScript & Type Safety

**Strict mode enabled.** Type errors prevent build.

**Type definitions colocated:** Don't import types from unrelated modules.

Example:
- `Item` and `Store` defined in app-store.tsx (not in utils or elsewhere)
- `Mode` and `ChatLine` defined in use-chat.ts
- `Tab` defined in AnalysisReport.tsx

## Common Debugging Steps

**"Unauthorized" errors from API:**
1. Check if session is present: `useSession()` may not have resolved yet
2. Check if route validates session with `auth.api.getSession()`
3. Check if route has `if (\!session) return 401`

**"Workflow failed" (process status = Failed):**
1. Check server console for error logs (`[METHOD] /path error:`)
2. Verify OPENROUTER_API_KEY set in .env.local
3. Verify TAVILY_API_KEY set (if company research node)
4. Check database `process` table for node status

**"Job content not loading":**
1. Check network tab for failed `/api/jobs/[id]` request
2. Verify session still valid (check /api/resumes for 401)
3. Check database for resume_jobs entry with correct jobId

**Chat not responding:**
1. Check server console for LLM errors
2. Verify OPENROUTER_API_KEY set
3. Check conversation history in cover_letter_history / message_gen_history tables
4. Verify job has company research + JD match (required for chat context)

## Architecture Evolution Notes

- Next.js App Router migration completed (see git history)
- Middleware removed (commit 540145d); now API-only validation
- PDF parsing added to support PDF resume extraction
- Prompts extracted to system-prompt.ts (commits a4604ce, 9db07f6)
- Jobs page refactored (commit beea0fa): chat to useChat hook, analysis to AnalysisReport, UI to ChatPanel
- AppStore fetch session-gated (commit 3df0c81); clearStore() on sign-out
