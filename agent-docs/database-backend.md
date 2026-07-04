# Database & Backend

## Database Schema (Drizzle ORM)

Located in `app/lib/db/schema.ts`. Uses PostgreSQL with Drizzle ORM for type-safe schema and queries.

### Core Tables

**Authentication (better-auth managed):**
- `user` — User accounts
- `session` — Session tokens with expiresAt timestamp
- `account` — OAuth/social login links (not used; email/password only)
- `verification` — Email verification codes

**Data tables (JobbedIn specific):**
- `resumes` — Resume uploads; userId FK
  - id (UUID PK), userId, name, content, createdAt, updatedAt
- `resume_jobs` — Job descriptions scoped to a resume; userId FK
  - id (UUID PK), userId, resumeId (FK), name, content, createdAt, updatedAt
- `companies` — Company research results from workflow
  - id (UUID PK), userId, jobId (FK to resume_jobs), content, createdAt, updatedAt
- `job_description_match` — JD vs resume matching analysis
  - id (UUID PK), userId, jobId (FK to resume_jobs), content, createdAt, updatedAt
- `resume_feedbacks` — Resume critique from workflow
  - id (UUID PK), userId, jobId (FK to resume_jobs), content, createdAt, updatedAt
- `cover_letter_history` — Generated cover letters + chat refinement history
  - jobId (UUID PK, FK to resume_jobs), userId, conversation (JSON array of ChatLine[]), createdAt, updatedAt
- `message_gen_history` — Generated recruiter messages + chat refinement history
  - jobId (UUID PK, FK to resume_jobs), userId, conversation (JSON array of ChatLine[]), createdAt, updatedAt
- `processes` — Workflow node status tracking
  - id (UUID PK), userId, jobId (FK to resume_jobs), processType (text), status (text: pending|processing|done|failed), createdAt, updatedAt

**Key constraints:**
- All non-auth tables have userId FK (user.id) and $onUpdate timestamps
- All job-related records reference resume_jobs.id via jobId
- process table tracks 5 node types: 'company', 'jdmatch', 'feedback', 'letter', 'message'
- cover_letter_history and message_gen_history use jobId as PK (one record per job)

## Database Client (app/lib/db/index.ts)

Initializes PostgreSQL client with environment variable validation.

**Required env vars:**
- PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE

If missing, the app crashes on import (fails early rather than at runtime).

```typescript
const db = postgres(connectionString);
export const drizzle = new Drizzle(db, { schema });
```

## API Session Validation Pattern

Every API route must validate session before accessing data:

```typescript
const session = await auth.api.getSession({ headers: request.headers });
if (\!session) {
  return new Response('Unauthorized', { status: 401 });
}

// All queries must scope to userId
const data = await db.query.resumes.findMany({
  where: eq(schema.resumes.userId, session.user.id),
});
```

**Critical:** Missing session validation opens route to unauthenticated access. Missing userId scoping in queries causes cross-user data leaks.

## API Error Handling

All API routes use `handleAsync` wrapper from `app/lib/api-handler.ts`:

```typescript
export const GET = handleAsync(async (request, ctx) => {
  // Handler code
  // Unhandled throws caught globally, logged, returned as 500
  return new Response(JSON.stringify(data), { status: 200 });
});
```

**Wrapper behavior:**
- Catches unhandled throws
- Logs `[METHOD] /path error: ${message}`
- Returns 500 JSON error response
- Supports both plain routes and dynamic `[id]` routes

**Intentional error responses** still returned explicitly inside handler (401, 400, 404).

## Migrations

Located in `drizzle/` directory. Tracked as SQL files.

**Commands:**
```bash
pnpm db:generate   # Generate migration from schema changes
pnpm db:push       # Push schema to PostgreSQL (creates/alters tables)
pnpm db:migrate    # Run pending migrations
pnpm test-db       # Validate PostgreSQL connection
```

**Schema changes:**
1. Edit `app/lib/db/schema.ts`
2. Run `pnpm db:generate` to create migration file
3. Review generated SQL in `drizzle/`
4. Run `pnpm db:push` or `pnpm db:migrate` to apply

## File Handling

Resume upload via POST `/api/resumes`:
- Validates file type (.pdf, .txt, .md)
- PDF: extracts text via pdf-parse
- TXT/MD: reads as UTF-8
- Returns 400 for unsupported formats
- Stores name (without extension) + content in database

**Gotchas:**
- pdf-parse fails on encrypted or malformed PDFs
- Large PDFs may timeout; no chunked processing implemented
- File naming: duplicate names create separate entries with same name but different UUID

## Better-auth Configuration

Located in `app/lib/auth/index.ts`:
- Email/password flow only (no OAuth)
- Drizzle ORM adapter for session/user storage
- Uses BETTER_AUTH_SECRET and ORIGIN env vars

**Email verification:**
- Controlled by EMAIL_ENABLED flag (process.env.EMAIL_ENABLED === 'true')
- When enabled: sign-up requires email verification; verification link sent via nodemailer; auto sign-in after verification
- When disabled: sign-up completes immediately (local dev mode)

**Password reset:**
- Triggered by POST request with email on login page (forgot-password mode)
- When enabled: reset link sent via nodemailer
- Handler calls `authClient.requestPasswordReset({email, redirectTo})` which generates token and sends email
- User clicks link in email, navigates to `/reset-password?token=...`, enters new password
- Reset handler calls `authClient.resetPassword({newPassword, token})`

**Account deletion:**
- Triggered by delete account mode on login page
- Requires user confirmation dialog, then password verification (sign-in)
- When EMAIL_ENABLED: deletion requires email confirmation link (sent via nodemailer); user clicks link to finalize deletion
- When EMAIL_ENABLED=false: deletion completes immediately via password verification (no email callback needed)
- Gotcha: Conditional spread of `sendDeleteAccountVerification` callback only when EMAIL_ENABLED=true; when false, better-auth skips email verification path and completes deletion via password

**Session management:**
- Cookies set automatically by better-auth
- `authClient.signOut()` clears cookies on client
- Does NOT invalidate database record (expiresAt is source of truth)
- Expired sessions still present in database

## Environment Variables

**PostgreSQL (required; crash on missing):**
- PGUSER
- PGPASSWORD
- PGHOST
- PGPORT
- PGDATABASE

Checked in `app/lib/db/index.ts` with early error throw.

**better-auth (required; crash if missing):**
- BETTER_AUTH_SECRET (generate random string, e.g., `openssl rand -base64 32`)
- ORIGIN (production domain, e.g., https://jobbedin.vercel.app)
- ORIGIN_DEV (optional; defaults to ORIGIN if not set)

**AI/Workflow (required for functionality; silent failure if missing):**
- OPENROUTER_API_KEY (required for all LLM nodes; returns 500 if missing)
- TAVILY_API_KEY (required for ResearchCompany node; node fails silently if missing)

**AI/Workflow (optional):**
- REASONING_MODEL (default: meta-llama/llama-3.1-8b-instruct)
- WRITING_MODEL (default: meta-llama/llama-3.1-8b-instruct)

**Email (optional; defaults to disabled):**
- EMAIL_ENABLED (set to 'true' to enable email; false disables all outbound email and email verification)
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (required only when EMAIL_ENABLED=true)
- When EMAIL_ENABLED=false: all sendEmail() calls become no-ops logged to console; email verification skipped on sign-up; account deletion completes immediately without email confirmation

Missing OPENROUTER_API_KEY causes silent failures in workflow; process status set to Failed without client error message.
Missing TAVILY_API_KEY causes ResearchCompany node to fail silently.
