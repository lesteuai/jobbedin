# App Store & State Management

## Purpose

Central React Context store for managing resume and job lists across the entire application. Provides CRUD operations (add, delete, select) for resumes and jobs, ensuring state persists when navigating between `/resumes` and `/jobs` routes within a session.

## Location

`src/lib/app-store.tsx` — Single file containing context definition, provider component, and hook

## Entry Points

- **Provider**: `AppStoreProvider` component wraps the root layout (`__root.tsx`)
- **Hook**: `useAppStore()` called from route components (`resumes.tsx`, `jobs.tsx`) to read/write state

## Architecture / Key Components

**Type Definitions**

```typescript
type Item = { id: string; name: string; content: string }

type Store = {
  resumes: Item[]
  jobs: Item[]
  selectedResumeId: string | null
  selectedJobId: string | null
  addResume: (name?: string) => string
  addJob: (content: string) => string
  deleteResume: (id: string) => void
  deleteJob: (id: string) => void
  selectResume: (id: string | null) => void
  selectJob: (id: string | null) => void
}
```

**Context Creation**

```typescript
const Ctx = createContext<Store | null>(null)
```

Null-checked on use; hook throws if called outside provider.

**Provider Implementation** (`AppStoreProvider`)

- Initializes state with two sample resumes and two sample jobs
- Provides methods to add/delete/select resumes and jobs
- Wraps children with `Ctx.Provider`

**Hook Implementation** (`useAppStore`)

- Retrieves context and throws if not inside provider
- Exposes all store methods to consumer components

## Data Flow

```
User interaction in /resumes or /jobs
  ↓
Route component calls useAppStore()
  ↓
Hook returns current state + action methods
  ↓
Route component calls action (addResume, selectJob, etc.)
  ↓
Provider state updates via setState
  ↓
Ctx.Provider notifies all subscribers
  ↓
Components re-render with new state
```

**Example: Adding a Resume**

```typescript
const { addResume } = useAppStore()

// In button onClick:
const newId = addResume("My Resume") // Returns generated ID like "r1234567890"
selectResume(newId)                    // Navigate to detail view
```

**Example: Deleting a Job**

```typescript
const { deleteJob, selectedJobId } = useAppStore()

// User confirms deletion:
deleteJob(jobId)
if (selectedJobId === jobId) {
  selectJob(null)  // Clear selection if deleting the active job
}
```

## Sample Data

**SAMPLE_RESUME**

```markdown
# Jane Doe
**Software Engineer** · jane@example.com · github.com/janedoe

## Experience
- **Acme Corp** — Senior Engineer (2022–Present). Shipped 3 AI agent products.
- **Globex** — Engineer (2019–2022). Led migration to TypeScript across 40k LoC.

## Skills
TypeScript, React, Python, LLM tooling, Postgres, AWS.

## Education
B.S. Computer Science, State University, 2019.
```

**SAMPLE_JOB**

```markdown
Senior Full-Stack Engineer — X (Remote)

We're building data-driven X-health software. Looking for engineers with:
- 4+ years TypeScript / React
- Experience shipping LLM-powered features
- Comfort with Postgres + cloud infra
- Bias toward clear writing and ownership
```

Initial state provides two copies of each, with Resume 2 having "Alex Park" substituted for "Jane Doe", and Job 2 having "Northwind Labs" substituted for "X".

## Patterns & Conventions

**ID Generation**

- Resume IDs: `r` + timestamp (e.g., `r1234567890`)
- Job IDs: `j` + timestamp (e.g., `j1234567890`)
- Timestamp generated via `Date.now()`, ensuring uniqueness within a session

**Add Methods**

- `addResume(name?: string)`: Creates resume with sample content; returns ID
- `addJob(content: string)`: Creates job with provided content (from textarea); returns ID

**Delete Methods**

- `deleteResume(id)`: Removes from resumes array; clears selection if active
- `deleteJob(id)`: Removes from jobs array; clears selection if active

**Select Methods**

- `selectResume(id | null)`: Sets selectedResumeId
- `selectJob(id | null)`: Sets selectedJobId

**State Updates**

All mutations use `setResumes(p => [...p, newItem])` (immutable array concatenation) to ensure React re-renders properly.

## Gotchas & Non-Obvious Logic

- **No persistence to localStorage**. Closing the browser or refreshing the page resets to initial sample data. Future work: persist to localStorage or backend.
- **Selection cleared on delete**. If a user deletes the currently selected resume/job, `selectedResumeId`/`selectedJobId` is set to null, which may surprise the UI (e.g., detail panel disappears). Routes handle this gracefully by rendering empty state.
- **Sample data mutation**. The second resume/job in initial state is created by string replacement (`.replace("Jane Doe", "Alex Park")`). If the sample text changes, the replace logic may fail silently, leaving identical data.
- **No validation**. `addJob()` accepts any string content, even empty. No length checks, no markdown validation. Future work: validate job descriptions before adding.
- **No conflict detection**. Adding a resume with the same name as an existing resume doesn't warn or prevent duplication. IDs keep them distinct, but UI may confuse users.
- **Race conditions impossible** (single-threaded React). No async/await in store mutations, so no issues with stale state.

## Consumers

- `src/routes/resumes.tsx` — Main consumer; lists, selects, deletes, and adds resumes
- `src/routes/jobs.tsx` — Main consumer; lists, selects, deletes, adds, and generates content for jobs
- Both routes import `useAppStore` and call methods in event handlers or useEffect cleanup

## Open Questions

- Should IDs be persisted to the backend and validated before use?
- Should there be an `updateResume()` / `updateJob()` method to edit content in place?
- Should the store expose a `getResume(id)` / `getJob(id)` method for type-safe lookups?
- Should the store track which resume-job pairs are "in progress" or "completed"?
