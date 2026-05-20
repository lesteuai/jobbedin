# Plan: Backend Integration for JobbedIn

## Overview
Wire the existing frontend shell to a PostgreSQL backend: resume file upload, job CRUD, static analysis pipeline, and persistent chat history. All state currently held in React Context (app-store) will be backed by API routes and the database.

## Tasks

### Task 1: Schema updates and DB push
**Status**: done
**Goal**: Add missing fields to schema and push to database so all subsequent API tasks have a valid schema to work with.
**Depends on**: none
**Details**:
- Add `name text` column to the `resumes` table in `app/lib/db/schema.ts`
- Add `name text` column to the `resume_jobs` table in `app/lib/db/schema.ts`
- Set `jobId` as the primary key on both `coverLetterHistory` and `messageGenHistory` tables (no new id column; `.primaryKey()` on the existing `jobId` field)
- Run `pnpm db:generate` to generate migration files (do not push to DB)
- Also import the schema in `app/lib/db/index.ts` (uncomment the `import * as schema` line and pass it to `drizzle()`) so the db client has type-safe access

### Task 2: Resume API routes
**Status**: pending
**Goal**: Create REST endpoints for listing, uploading, and deleting resumes.
**Depends on**: Task 1
**Details**:
- `GET /api/resumes` -- query all rows from `resumes` table ordered by `createdAt` desc; return `[{id, name, content, createdAt}]`
- `POST /api/resumes` -- accept multipart form data with a file field named `file`; for `.txt` and `.md` files decode buffer to string; for `.pdf` use the already-installed `pdf-parse` package to extract text; insert a new row into `resumes` with `id = crypto.randomUUID()`, `name = file.name` (original filename without extension), `content = extracted text`; return the new row
- `DELETE /api/resumes/[id]` -- delete the resume row by id (cascade will clean up child rows); return `{success: true}`
- All routes live in `app/api/resumes/route.ts` (GET + POST) and `app/api/resumes/[id]/route.ts` (DELETE)
- Use `app/lib/db/index.ts` for the db client and import table definitions from `app/lib/db/schema.ts`
- Note: `pdf-parse` v2 is already in `package.json`; import as `import pdfParse from 'pdf-parse'` and call `pdfParse(buffer)` -- the result has a `.text` property
- Handle multipart in Next.js App Router using `request.formData()` then `formData.get('file') as File` then `Buffer.from(await file.arrayBuffer())`

### Task 3: Job API routes
**Status**: done
**Goal**: Create REST endpoints for listing, creating, and deleting resume jobs.
**Depends on**: Task 1
**Details**:
- `GET /api/jobs?resumeId=<uuid>` -- query `resume_jobs` where `resumeId = param` ordered by `createdAt` asc; return `[{id, name, content, resumeId, createdAt}]`
- `POST /api/jobs` -- body `{resumeId: string, content: string}`; count existing jobs for this resume to auto-name `Job N`; insert new row with `id = crypto.randomUUID()`, `name`, `resumeId`, `content`; return the new row
- `DELETE /api/jobs/[id]` -- delete the job row by id; return `{success: true}`
- Routes in `app/api/jobs/route.ts` (GET + POST) and `app/api/jobs/[id]/route.ts` (DELETE)

### Task 4: Analyze API routes
**Status**: pending
**Goal**: Create endpoints to trigger analysis (inserting static data) and retrieve analysis results.
**Depends on**: Task 1
**Details**:
- `POST /api/jobs/[id]/analyze`:
  - Insert or update rows in `companies`, `job_description_match`, `resume_feedbacks` tables with the static MOCK content currently hardcoded in `app/jobs/page.tsx` (the `MOCK` object). Use upsert (Drizzle `onConflictDoUpdate`) keyed on `jobId`; if no unique constraint use a plain insert after deleting existing rows for that jobId
  - Insert 5 rows into `processes` table (one per `ProcessType` enum value: company, jdmatch, feedback, letter, message), all with `status = ProcessStatus.Done`; upsert by `(jobId, processType)` or delete+insert
  - Return `{success: true}`
- `GET /api/jobs/[id]/analysis`:
  - Query `companies`, `job_description_match`, `resume_feedbacks`, `processes` for the given jobId
  - Return `{company: string|null, jdMatch: string|null, feedback: string|null, processes: [{processType, status}]}`
- Routes in `app/api/jobs/[id]/analyze/route.ts` (POST) and `app/api/jobs/[id]/analysis/route.ts` (GET)
- The MOCK strings to use are already in `app/jobs/page.tsx` in the `MOCK` constant -- copy them to a shared constant in the API file (do not import from the client page)

### Task 5: Chat history API routes
**Status**: pending
**Goal**: Create endpoints to load and save per-job chat history for cover letter and message generation.
**Depends on**: Task 1
**Details**:
- `GET /api/jobs/[id]/chat?mode=letter|message`:
  - Map `mode=letter` to `coverLetterHistory` table, `mode=message` to `messageGenHistory` table
  - Query by `jobId`; if no row exists return `{conversation: []}`
  - The `conversation` column is `json` type; parse and return it as `{conversation: ChatLine[]}`
  - `ChatLine` type is `{role: 'user' | 'ai', text: string}`
- `POST /api/jobs/[id]/chat`:
  - Body `{mode: 'letter' | 'message', conversation: ChatLine[]}`
  - Upsert (delete existing + insert, or use onConflictDoUpdate on `jobId` PK added in Task 1) the full conversation array as JSON
  - Return `{success: true}`
- Routes in `app/api/jobs/[id]/chat/route.ts` (GET + POST)

### Task 6: Update app-store to use API
**Status**: pending
**Goal**: Replace all client-side in-memory state in app-store with API calls so data persists across page refreshes.
**Depends on**: Task 2, Task 3
**Details**:
- The store currently lives in `app/lib/app-store.tsx`; keep the same exported interface (`useAppStore`, `AppStoreProvider`) so pages don't need import changes
- Add async loading: on mount, call `GET /api/resumes` and populate `resumes` state. When `selectedResumeId` changes (and is non-null), call `GET /api/jobs?resumeId=...` and populate `jobs` state
- `addResume` becomes a no-op placeholder (file upload is handled directly in the resumes page -- see Task 7); remove or stub it out. The resumes page will call the API directly and then call a new `refreshResumes()` store method to reload the list
- `addJob(content)` should POST to `/api/jobs` with `{resumeId: selectedResumeId, content}` and add the returned job to local `jobs` state; return the new job id
- `deleteResume(id)` should DELETE `/api/resumes/${id}` then remove from local state
- `deleteJob(id)` should DELETE `/api/jobs/${id}` then remove from local state
- Export a `refreshResumes()` method that re-fetches `/api/resumes` and updates state
- Remove the hardcoded `SAMPLE_RESUME`, `SAMPLE_JOB` seed data and the two default items in useState
- Keep the selected id fields and their setters as-is (they remain client-only navigation state)
- The `Item` type stays as `{id: string; name: string; content: string}`

### Task 7: Update resumes page for file upload
**Status**: pending
**Goal**: Replace the mock "Add resume" button with a real file input and wire the page to the updated app-store.
**Depends on**: Task 6
**Details**:
- File: `app/resumes/page.tsx`
- Change the "+ Add resume" `onAdd` handler: instead of calling `addResume()`, trigger a hidden `<input type="file" accept=".pdf,.txt,.md">` element via a ref click
- In the file input's `onChange` handler: read the selected file, POST it to `/api/resumes` as `FormData` with field name `file`, then call `refreshResumes()` from the store and select the new resume's id
- Show a loading/uploading state while the POST is in flight (disable the button, show "Uploading...")
- Remove the "(Supports .pdf and .docx -- mock)" text; replace with "(Supports .pdf, .txt, .md)"
- The `deleteResume` and `selectResume` calls stay the same (now backed by API via the store)

### Task 8: Update jobs page - full integration
**Status**: pending
**Goal**: Wire the jobs page to backend for CRUD, analyze, and chat history.
**Depends on**: Task 6, Task 4, Task 5
**Details**:
- File: `app/jobs/page.tsx`
- **Fix OK button**: The OK button currently calls `addJob` then immediately sets view to `'report'`. Change it to call `addJob(draft.trim())`, then set view to `'view'` (show the job description, not the analysis). Do not navigate to report on save.
- **Load analysis from backend**: Remove the hardcoded `MOCK` constant. When the user presses "Analyze →", call `POST /api/jobs/${selectedJobId}/analyze`, then fetch `GET /api/jobs/${selectedJobId}/analysis` and store the result in local state (`analysisData: {company, jdMatch, feedback} | null`). Show a loading indicator while the POST is in flight.
- **Render analysis tabs from backend data**: In the Company/JDMatch/Feedback tabs, render from `analysisData` instead of `MOCK`. If `analysisData` is null (not yet analyzed), show a prompt "Click Analyze to generate analysis."
- **Chat persistence**: 
  - When entering the Generate tab (tab === 'Generate') or when `selectedJobId` changes, fetch `GET /api/jobs/${selectedJobId}/chat?mode=letter` and `?mode=message` to load history; initialize `chats` state from these responses instead of `SEED`
  - After each `handleSend`, call `POST /api/jobs/${selectedJobId}/chat` with `{mode, conversation: updatedLines}` to save
  - The SEED constant and PLACEHOLDER constant can stay for the initial placeholder text, but actual chat state comes from the API; if the API returns an empty array for a mode, show the empty state (no seed data pre-populated)
  - Mock AI responses stay the same (static strings) -- just persist the conversation including them
  - After `handleClear`, also call POST to save the empty array
