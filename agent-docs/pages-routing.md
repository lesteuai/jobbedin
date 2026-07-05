# Pages & Routing

## Key Entry Points

- `app/layout.tsx` — Root layout with metadata and AppStoreProvider wrapper
- `app/page.tsx` — Login page with 4 modes: signin, signup, forgot-password, delete-account (public)
- `app/reset-password/page.tsx` — Password reset form; reads token from query string; calls authClient.resetPassword() (public)
- `app/resumes/page.tsx` — Resume management, preview, and "To Job" navigation; API-protected via session validation
- `app/resumes/[id]/page.tsx` — Job analysis hub for selected resume; calls selectResume() on mount; delegates to AnalysisReport and useChat hook

## Route Structure

```
/                           → Login page (public; 4 modes: signin, signup, forgot, delete)
/reset-password             → Password reset form with token (public)
/settings                   → User settings: password change, custom AI prompts (session-gated)
/resumes                    → Resume list and management (session-gated API)
/resumes/[id]               → Job analysis hub for resume (session-gated API)

API routes (all session-validated, userId-scoped):
/api/auth/[...all]          → better-auth handler (sign-in, sign-up, sign-out)
/api/resumes                → GET (list), POST (upload)
/api/resumes/[id]           → GET (single), DELETE
/api/jobs                   → GET (list by resumeId), POST (create)
/api/jobs/[id]              → GET (single), DELETE
/api/jobs/[id]/analyze      → POST (trigger workflow, returns 202)
/api/jobs/[id]/analysis     → GET (workflow results + process status, one-shot)
/api/jobs/[id]/analysis-stream → GET (SSE: streams workflow results + process status every 1s)
/api/jobs/[id]/chat         → GET (conversation history), POST (send message or clear, uses custom prompts)
/api/settings               → GET (fetch custom AI prompts), PUT (upsert custom AI prompts)
```

## Data Flow

1. User signs in/up on login page via better-auth
2. Navigate to /resumes; API validates session (401 if missing)
3. Upload resumes (PDF, TXT, MD); UUID stored in PostgreSQL with userId FK
4. Click "To Job" button; navigates to `/resumes/[resumeId]`
5. Add job descriptions (pasted as text); stored in resume_jobs table
6. Click "Analyze" → POST `/api/jobs/[id]/analyze` → returns 202 immediately
7. LangGraph workflow executes asynchronously in background
8. Frontend opens EventSource to `/api/jobs/[id]/analysis-stream` (SSE)
9. Server streams workflow results + all 5 process statuses every 1s until all complete
10. When all 5 processes reach Done or Failed → stream closes, UI loads full analysis + generated content
11. Chat interface for iterative refinement → POST `/api/jobs/[id]/chat` with userMessage
12. LLM response persisted to database; conversation history stored in conversation column

## Page Implementation Details

### app/page.tsx (Login)
- Manages 4 modes: 'signin', 'signup', 'forgot', 'delete'
- Sign in: email + password via `authClient.signIn.email({email, password})`; auto-navigates to /resumes
- Sign up: email + password via `authClient.signUp.email({email, password, name})`; auto-navigates to /resumes
- Forgot password: email only; calls `authClient.requestPasswordReset({email, redirectTo: '/reset-password'})` which triggers email send if EMAIL_ENABLED
- Delete account: requires confirmation dialog, password verification (sign-in), then `authClient.deleteUser({password})`; shows info message about potential email confirmation requirement
- Auto-redirects to /resumes if session exists, except during delete mode (skip redirect to allow deletion flow to complete)
- Resend email: when `EMAIL_ENABLED` and an email was just sent (`emailSent` state), a footer link re-sends the current mode's email via `handleResend()`: verification (`authClient.sendVerificationEmail`), reset link (`requestPasswordReset`), or delete confirmation (`deleteUser`, reusing the transient session). A 30s `cooldown` (ticked by a `setInterval` effect) disables the link and shows "Resend in Ns"

### app/reset-password/page.tsx
- Wrapped in Suspense due to useSearchParams dependency
- Reads token from query string
- Submits via `authClient.resetPassword({newPassword, token})`
- Shows success state with button back to sign in
- Shows error state if token missing or reset fails

### app/settings/page.tsx
- Protected page for authenticated users; redirects to "/" if session missing
- Two main sections: Change Password and Custom AI Instructions
- **Change Password:** Requires current password + new password; calls `authClient.changePassword({currentPassword, newPassword})`; shows success/error messages
- **Custom AI Instructions:** Two textareas for cover letter and recruiter message custom instructions
  - Loads existing instructions on mount via GET /api/settings
  - Saves on submit via PUT /api/settings with { customLetterInstructions, customMsgInstructions }
  - Instructions are optional (leave blank to use defaults)
  - Textarea height is fixed (5 rows, resize: none) per convention
- All fields disabled during submission (passwordSaving, promptsSaving flags)

### app/page.tsx (Login Page) — Resend Email Controls
- Added `emailSent` state (true after successful signup/forgot/delete send)
- Added `cooldown` state (30s countdown after each send)
- Added `handleResend()` that re-sends based on current mode:
  - `signup` → calls `authClient.sendVerificationEmail({email, callbackURL: '/'})`
  - `forgot` → calls `authClient.requestPasswordReset({email, redirectTo: '/reset-password'})`
  - `delete` → calls `authClient.deleteUser({password})` (reuses transient session from initial delete)
- Resend link appears in footer when `EMAIL_ENABLED && emailSent`; shows "Resend in Ns" during cooldown (disabled while cooldown > 0)
- Mode changes reset emailSent and cooldown to 0
- All resend operations gated by EMAIL_ENABLED flag

### app/resumes/page.tsx
- Resume list, selection, markdown preview
- Hidden file input for upload (triggers userId-scoped API POST)
- Supports .pdf, .txt, .md file types
- "To Job" button navigates to `/resumes/${selectedResumeId}`

### app/resumes/[id]/page.tsx
- Accepts resumeId from URL via useParams()
- Calls selectResume(resumeId) on mount
- Manages job list (add, delete, select)
- SSE stream after "Analyze" click: EventSource connects to `/api/jobs/[id]/analysis-stream`
- Server pushes workflow results + process statuses every 1s; client updates UI reactively
- Stream closes when all 5 processes are terminal (Done or Failed)
- Delegates analysis display to AnalysisReport component
- Delegates chat logic to useChat hook
- handleSelect(id) is async, awaits selectJob(id) before switching view (catches errors, keeps current view on failure)
- addJob onClick is async, awaits both addJob() and selectJob(id) in sequence

## API Routes Detail

All routes validate session via `auth.api.getSession({ headers: request.headers })` and scope queries to userId.

**Resume routes:**
- `GET /api/resumes` — List resumes (userId-scoped, excludes content for speed)
- `POST /api/resumes` — Upload resume from multipart/form-data; validates file type (.pdf, .txt, .md), extracts content (pdf-parse for PDFs, UTF-8 for text), stores name + content, returns { id }
- `GET /api/resumes/[id]` — Get single resume with full content (lazy load)
- `DELETE /api/resumes/[id]` — Remove resume and all related jobs/analysis

**Job routes:**
- `GET /api/jobs?resumeId=...` — List jobs filtered by resumeId (userId-scoped, excludes content)
- `POST /api/jobs` — Create job with description; auto-names as "Job 1", "Job 2", etc., returns full job object
- `GET /api/jobs/[id]` — Get single job with full content (lazy load)
- `DELETE /api/jobs/[id]` — Remove job (userId-scoped)

**Analysis/Workflow routes:**
- `POST /api/jobs/[id]/analyze` — Trigger LangGraph workflow; checks if already running, creates 5 process records, fire-and-forgets runWorkflow(), returns 202
- `GET /api/jobs/[id]/analysis` — Get workflow results: company, jdMatch, feedback, letterConversation, messageConversation, array of 5 process statuses (one-shot snapshot)
- `GET /api/jobs/[id]/analysis-stream` — SSE stream; polls database every 1s and sends all results + process statuses to client; stream closes when all 5 processes are terminal

**Chat routes:**
- `GET /api/jobs/[id]/chat?mode=...` — Get conversation history for 'letter' or 'message' mode
- `POST /api/jobs/[id]/chat` — Accept { mode, userMessage, conversation? }; if userMessage: invoke ChatOpenAI with system prompt + history, persist to DB, return { reply }; if conversation: clear and set new history

## Frontend Streaming Pattern (Server-Sent Events)

When user clicks "Analyze":
1. POST `/api/jobs/[id]/analyze` → 202 accepted
2. Set isAnalyzing=true
3. Open EventSource to `/api/jobs/[id]/analysis-stream`
4. Server streams JSON messages every 1s with all 5 process statuses + generated content
5. Client parses each message and updates component state reactively
6. When all 5 processes reach Done or Failed, server closes stream
7. Client detects stream close, sets isAnalyzing=false, displays complete analysis

This pattern (SSE vs. client polling) reduces client overhead, consolidates logic on server (where data lives), and uses native browser EventSource API.
