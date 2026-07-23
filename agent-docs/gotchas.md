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

## EMAIL_ENABLED Flag Behavior

Located in `app/lib/email.ts`, exported as `EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'`.

**When EMAIL_ENABLED=true:**
- All email callbacks wired: sign-up verification, password reset, account deletion confirmation
- `sendEmail()` uses nodemailer to send via SMTP (requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
- Email verification required on sign-up; auto sign-in after verification
- Password reset requires clicking emailed token link
- Account deletion requires clicking emailed confirmation link

**When EMAIL_ENABLED=false (default for local dev):**
- All `sendEmail()` calls become no-ops; console.log instead
- Email verification skipped; sign-up completes immediately
- Password reset does NOT send email (feature disabled; sign-up flow still works without email)
- Account deletion completes immediately via password verification (no email callback needed)

**Critical gotcha for deleteUser:**
- better-auth has conditional logic: if `sendDeleteAccountVerification` callback is NOT defined, deletion completes via password
- This callback is conditionally spread into config ONLY when EMAIL_ENABLED=true
- Result: Local runs (EMAIL_ENABLED=false) delete immediately; production runs (EMAIL_ENABLED=true) require email confirmation
- If EMAIL_ENABLED is true but SMTP vars missing, sendEmail() will crash the workflow

## Environment Variables

**No validation on startup.** Missing vars crash during module import.

**PostgreSQL vars (required):**
- PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE

**better-auth vars (required):**
- BETTER_AUTH_SECRET, ORIGIN, ORIGIN_DEV

**Email vars (optional):**
- EMAIL_ENABLED (defaults to false; set to 'true' to enable email)
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (required only when EMAIL_ENABLED=true)
- If EMAIL_ENABLED=true but SMTP vars missing, sendEmail() crashes

**Workflow vars:**
- OPENROUTER_API_KEY (required for LLM nodes; used as fallback when user does not provide key)
- TAVILY_API_KEY (required for company research)
- REASONING_MODEL, WRITING_MODEL (optional; defaults to meta-llama/llama-3.1-8b-instruct:free)

**Encryption (Bring Your Own OpenRouter Key):**
- BETTER_AUTH_SECRET (now used for both session signing AND deriving encryption key for stored API keys)
- App crashes on import if BETTER_AUTH_SECRET missing
- User API keys stored encrypted in user_settings.openrouterApiKey using AES-256-GCM
- If BETTER_AUTH_SECRET changes, all stored user keys become unrecoverable

**Failure mode:** App crashes on import if required vars missing

## Server-Sent Events (SSE) Streaming

**Analysis updates via SSE (`/api/jobs/[id]/analysis-stream`):**
- Server-side interval polls database every 1s
- EventSource stays open until all 5 processes are terminal
- Client must clean up EventSource on component unmount or when stream closes

**Connection management:**
- Store EventSource ref in useRef (not state) to avoid re-creating on render
- Always call `es.close()` before opening a new stream (prevent multiple active streams)
- Call `es.close()` in cleanup effect to prevent memory leaks
- Stream auto-closes when controller.close() is called on server

**Error handling:**
- onerror handler fires if connection drops or server errors
- Transient JSON parse errors ignored (malformed messages skipped)
- Treat all stream errors as terminal (stop trying, set isAnalyzing=false)

## LangGraph Workflow Issues

### Missing API Keys

**OPENROUTER_API_KEY missing:** All LLM nodes fail silently
- Process status set to Failed
- Error only logged to server console
- Frontend sees Failed status on next stream message

**TAVILY_API_KEY missing:** ResearchCompany node fails
- Same silent failure pattern

### Out-of-Credit Detection (HTTP 402)

**Detection mechanism:** Each node catches errors and checks `isOutOfCreditError()`, which detects APIError with status/code === 402

**When out-of-credit:**
- Process status set to Failed with statusReason = 'out_of_credit'
- SSE stream includes statusReason in payload (frontend can render "out of credit" message)
- If user has their own API key set, it's used exclusively (no fallback to server key on 402)
- If user does not have key, 402 indicates server key is out of credit

**Stream terminal state guarantee:** After workflow.invoke() completes or throws, app.invoke() catch updates any leftover pending/processing processes to Failed. Ensures SSE stream doesn't hang if upstream node fails (e.g., Company fails → Letter/Message never run → their rows stay pending without cleanup)

**Gotcha:** Decrypt of user API key can fail (malformed payload, wrong BETTER_AUTH_SECRET). On decrypt error, userApiKey set to undefined and server key is used silently. Console logs the error but frontend doesn't know key loading failed.

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

## Settings API Partial Updates

The `/api/settings` PUT route supports partial updates to avoid clobbering unmodified fields:
- Only fields present in request body are updated
- Saving API key does not clear custom instructions (and vice versa)
- If body is empty, route returns 200 with no changes
- Empty string values (e.g., `customLetterInstructions: ""`) are treated as intentional updates (clears the field)

**Gotcha:** OpenRouter API key is trimmed client-side before sending; empty/whitespace-only input treated as "no key to set" (not sent in request body). To clear a key, send `clearOpenrouterApiKey: true` instead.

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
2. Verify OPENROUTER_API_KEY set (or user has provided key in settings)
3. Check conversation history in cover_letter_history / message_gen_history tables
4. Verify job has company research + JD match (required for chat context)
5. If HTTP 402 on chat send, indicates out of credit; check if user key is set (settings page)

**"Out of credit" (HTTP 402 on analysis or chat):**
1. Check process table: statusReason = 'out_of_credit' confirms out-of-credit error
2. Check if user has OpenRouter key saved (GET /api/settings returns hasOpenrouterApiKey)
3. If user key set: their key is out of credit; ask them to add more funds or switch to server key
4. If no user key set: server key (OPENROUTER_API_KEY) is out of credit; need to refill or set user keys

**Settings API not saving:**
1. Ensure request body includes field name (e.g., `{ "customLetterInstructions": "..." }`)
2. To clear API key, send `{ "clearOpenrouterApiKey": true }` not `{ "openrouterApiKey": "" }`
3. Verify content-type header is application/json
4. Check network response status (should be 200 with `{ "success": true }`)

## Architecture Evolution Notes

- Next.js App Router migration completed
- Middleware removed; now API-only validation
- PDF parsing added to support PDF resume extraction
- Prompts extracted to system-prompt.ts for reuse between workflow and chat
- Jobs page refactored: chat moved to useChat hook, analysis to AnalysisReport component, UI to ChatPanel
- AppStore fetch session-gated; clearStore() called on sign-out
- Components reorganized: all UI primitives and state under `app/lib/` (not spread across root)
- useChat hook moved to `app/lib/hooks/` alongside other app-level hooks
- Resume lazy-loading implemented: selectResume() fetches content only on first selection
- Job lazy-loading implemented: selectJob() fetches content only on first selection
- Analysis streaming refactored: EventSource replaces client polling; server streams via `/api/jobs/[id]/analysis-stream` SSE endpoint
- OpenRouter out-of-credit detection added: HTTP 402 errors set statusReason on process records; ensures SSE stream reaches terminal state even if upstream node fails
- Bring Your Own OpenRouter Key (BYOK) added: users can store encrypted API key in user_settings; LLM factories support per-user keys with fallback to server key
- Encryption module added (crypto.ts): AES-256-GCM with key derived from BETTER_AUTH_SECRET
- Settings API refactored: PUT supports partial updates to preserve unmodified fields (e.g., saving API key doesn't clobber custom prompts)
