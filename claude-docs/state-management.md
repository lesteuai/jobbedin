# State Management & Store

## AppStore Context (app/lib/app-store.tsx)

Provides global resume/job state and CRUD operations via React Context. Data fetch is session-gated: `useSession()` must return a user before `refreshResumes()` is called. This prevents 401 errors on initial page load.

### Store Interface

```typescript
type Item = {
  id: string;
  resumeId?: string;        // jobs have resumeId FK
  name: string;
  content: string;          // lazily loaded for jobs
  conversation?: string[];  // chat history
  createdAt: Date;
  updatedAt: Date;
}

type Store = {
  resumes: Item[];
  jobs: Item[];
  selectedResumeId: string | null;
  selectedJobId: string | null;
  selectedJob: Item | null;
  isLoading: boolean;
  error: string | null;
  
  // CRUD operations
  addResume(file: File, name: string): Promise<void>;
  deleteResume(id: string): Promise<void>;
  refreshResumes(): Promise<void>;
  selectResume(id: string): Promise<void>;
  
  addJob(resumeId: string, description: string): Promise<string>;
  deleteJob(id: string): Promise<void>;
  selectJob(id: string | null): Promise<void>;  // async, lazy-loads job content
  clearStore(): void;  // reset all state on sign-out
  showError(message: string): void;
}
```

### Key Behaviors

**Session-gated data fetch:**
- `useAppStore()` watches `session.user.id` via `useSession()` hook
- `refreshResumes()` only executes once session is present
- Prevents spurious 401 errors on page load when session still resolving

**Lazy job loading:**
- `selectJob(id)` checks if job content is already loaded (detects by presence of content field)
- If not loaded, fetches full job data from `GET /api/jobs/${id}`
- Once loaded, subsequent calls skip the fetch
- If fetch fails, throws after calling `showError()`; callers catch the exception

**Clear on sign-out:**
- `clearStore()` resets all in-memory state (resumes, jobs, selected items)
- Called from login page after `authClient.signOut()` to remove cached data

**CRUD operations backed by API:**
- `addResume()` POSTs to `/api/resumes` with file + name
- `deleteResume()` DELETEs from `/api/resumes/[id]`
- `addJob()` POSTs to `/api/jobs` with description, returns jobId
- `deleteJob()` DELETEs from `/api/jobs/[id]`
- All operations trigger state refresh after completion

## Usage in Components

```typescript
const { resumes, selectedJob, addJob, selectJob } = useAppStore();
// Throws if called outside AppStoreProvider
```

State survives page refresh because it's persisted to PostgreSQL and re-fetched via session-gated API calls on each mount.

See [State Management](../claude-docs/state-management.md) for implementation details.
