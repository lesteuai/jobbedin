# Pages & Routing

## Key Entry Points

- `app/layout.tsx` — Root layout with metadata and AppStoreProvider wrapper
- `app/page.tsx` — Login page with better-auth sign-in/sign-up integration (public)
- `app/resumes/page.tsx` — Resume management, preview, and "To Job" navigation; API-protected via session validation
- `app/resumes/[id]/page.tsx` — Job analysis hub for selected resume; calls selectResume() on mount; delegates to AnalysisReport and useChat hook

## Route Structure

```
/                           → Login page (public)
/resumes                    → Resume list and management (session-gated API)
/resumes/[id]               → Job analysis hub for resume (session-gated API)

API routes (all session-validated, userId-scoped):
/api/auth/[...all]          → better-auth handler (sign-in, sign-up, sign-out)
/api/resumes                → GET (list), POST (upload)
/api/resumes/[id]           → GET (single), DELETE
/api/jobs                   → GET (list by resumeId), POST (create)
/api/jobs/[id]              → GET (single), DELETE
/api/jobs/[id]/analyze      → POST (trigger workflow, returns 202)
/api/jobs/[id]/analysis     → GET (workflow results + process status)
/api/jobs/[id]/chat         → GET (conversation history), POST (send message or clear)
```

## Data Flow

1. User signs in/up on login page via better-auth
2. Navigate to /resumes; API validates session (401 if missing)
3. Upload resumes (PDF, TXT, MD); UUID stored in PostgreSQL with userId FK
4. Click "To Job" button; navigates to `/resumes/[resumeId]`
5. Add job descriptions (pasted as text); stored in resume_jobs table
6. Click "Analyze" → POST `/api/jobs/[id]/analyze` → returns 202 immediately
7. LangGraph workflow executes asynchronously in background
8. Frontend polls `/api/jobs/[id]/analysis` every 1s to display progress
9. When all 5 processes complete → UI loads full analysis + generated content
10. Chat interface for iterative refinement → POST `/api/jobs/[id]/chat` with userMessage
11. LLM response persisted to database; conversation history stored in conversation column

## Page Implementation Details

### app/resumes/page.tsx
- Resume list, selection, markdown preview
- Hidden file input for upload (triggers userId-scoped API POST)
- Supports .pdf, .txt, .md file types
- "To Job" button navigates to `/resumes/${selectedResumeId}`

### app/resumes/[id]/page.tsx
- Accepts resumeId from URL via useParams()
- Calls selectResume(resumeId) on mount
- Manages job list (add, delete, select)
- Polling loop after "Analyze" click: setInterval fetches `/api/jobs/[id]/analysis` every 1s
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
- `GET /api/jobs/[id]/analysis` — Get workflow results: company, jdMatch, feedback, letterConversation, messageConversation, array of 5 process statuses (for polling)

**Chat routes:**
- `GET /api/jobs/[id]/chat?mode=...` — Get conversation history for 'letter' or 'message' mode
- `POST /api/jobs/[id]/chat` — Accept { mode, userMessage, conversation? }; if userMessage: invoke ChatOpenAI with system prompt + history, persist to DB, return { reply }; if conversation: clear and set new history

## Frontend Polling Pattern

When user clicks "Analyze":
1. POST `/api/jobs/[id]/analyze` → 202 accepted
2. Set isAnalyzing=true
3. startPolling(jobId) spawns setInterval every 1s
4. Fetch `/api/jobs/[id]/analysis` → returns all 5 process statuses + generated content
5. Display progress (e.g., "Company: Processing", "JDMatch: Done")
6. Loop terminates when all 5 processes reach Done or Failed
7. UI loads complete analysis from database

This pattern allows real-time visibility into asynchronous workflow progress without blocking the user.
