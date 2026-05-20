# State Management & Store

## Purpose

The AppStore context (`app/lib/app-store.tsx`) provides global state for managing resumes and jobs across pages. It exposes a React Context with CRUD operations, allowing pages to read and mutate items without prop drilling.

## Location

- `app/lib/app-store.tsx` — Context definition, provider component, and hook
- Used by: `app/resumes/page.tsx`, `app/jobs/page.tsx`

## Entry Points

- `export function AppStoreProvider({ children })` — Wrap root layout with this provider
- `export function useAppStore()` — Call in any `'use client'` component to consume state
- Already wrapped in `app/layout.tsx`

## Architecture / Key Components

### Type: Item
```tsx
type Item = { id: string; name: string; content: string };
```
Represents a resume or job. Used for both but could be split into separate types if needed.

### Type: Store
```tsx
type Store = {
  resumes: Item[];
  jobs: Item[];
  selectedResumeId: string | null;
  selectedJobId: string | null;
  addResume: (name?: string) => string;
  addJob: (content: string) => string;
  deleteResume: (id: string) => void;
  deleteJob: (id: string) => void;
  selectResume: (id: string | null) => void;
  selectJob: (id: string | null) => void;
};
```
Exposes arrays, selection IDs, and callback functions for mutations.

### Context Creation
```tsx
const Ctx = createContext<Store | null>(null);
```
Initialized as null; throws if useAppStore is called outside provider.

### Sample Data
Two seed resumes and two seed jobs are created on mount:
- `SAMPLE_RESUME` — Jane Doe resume with experience at Acme Corp and Globex
- `SAMPLE_JOB` — Senior Full-Stack Engineer role (X company)
Duplicates are modified (e.g., "Jane Doe" → "Alex Park", "X" → "Northwind Labs") for variety.

### CRUD Operations

**addResume(name?: string)**
- Creates a new resume with id = `r${Date.now()}`
- Name defaults to "Resume {length + 1}" if not provided
- Content copied from SAMPLE_RESUME
- Returns the new resume ID
- Used in: Resumes page, "Add resume" button

**addJob(content: string)**
- Creates a new job with id = `j${Date.now()}`
- Name always "Job {length + 1}"
- Content passed as parameter (user-pasted job description)
- Returns the new job ID
- Used in: Jobs page, "Add Job" form submission

**deleteResume(id: string)**
- Removes resume from array
- Clears selectedResumeId if deleted item was selected
- Used in: Resumes page, delete confirmation modal

**deleteJob(id: string)**
- Removes job from array
- Clears selectedJobId if deleted item was selected
- Used in: Jobs page, delete confirmation modal

**selectResume(id: string | null)**
- Sets selectedResumeId (null to deselect)
- Used in: Resumes page, sidebar click handler

**selectJob(id: string | null)**
- Sets selectedJobId (null to deselect)
- Used in: Jobs page, sidebar click handler

## Data Flow

```
AppStoreProvider
├── useState(resumes) + seed data
├── useState(jobs) + seed data
├── useState(selectedResumeId)
├── useState(selectedJobId)
└── Ctx.Provider
    └── children (entire app)

useAppStore() hook
├── useContext(Ctx)
├── Throws if null (outside provider)
└── Returns { resumes, jobs, selectedResumeId, ... }

Page component
├── const { resumes, selectedResumeId, selectResume, ... } = useAppStore()
├── Renders list from context
└── Callbacks update context state
```

**Example flow (Resumes page):**
1. Component calls `useAppStore()`
2. Reads `resumes`, `selectedResumeId`
3. User clicks resume in Sidebar → calls `selectResume(id)`
4. Context state updates → component re-renders
5. Shows markdown preview of `selected.content`

## Dependencies

**Internal:**
- React: `createContext`, `useContext`, `useState`, `ReactNode`

**External:**
- None; pure React

## Consumers

- `app/layout.tsx` — Wraps app with provider
- `app/resumes/page.tsx` — useAppStore() for resume CRUD and selection
- `app/jobs/page.tsx` — useAppStore() for job CRUD and selection

## Patterns & Conventions

**ID generation:**
- Resumes: `r${Date.now()}` (r = resume prefix)
- Jobs: `j${Date.now()}` (j = job prefix)
- Not UUIDs; timestamp-based for simplicity (sufficient for client-only state)

**Selection state:**
- `selectedResumeId` and `selectedJobId` are independent
- Both are nullable (null = no selection)
- Pages explicitly call `selectResume(null)` or `selectJob(null)` to deselect
- Deselection on delete is automatic (context checks before clearing)

**Mutation pattern:**
All mutations follow this pattern:
```tsx
const addResume = (name?: string) => {
  const id = `r${Date.now()}`;
  const n = name ?? `Resume ${resumes.length + 1}`;
  setResumes((p) => [...p, { id, name: n, content: SAMPLE_RESUME }]);
  return id;
};
```

Uses functional setState to access previous state. Immutable array updates via spread operator.

**Error handling:**
`useAppStore()` throws if called outside provider:
```tsx
if (!c) throw new Error("useAppStore must be inside AppStoreProvider");
```
This is intentional; it catches misconfiguration early.

**Name vs. Content:**
- `name` — Display label in sidebar (e.g., "Resume 1", "Job 1")
- `content` — Full markdown content for preview
- Both are required; no separation between metadata and data

## Gotchas & Non-Obvious Logic

**No persistence:**
All state is in-memory. Refreshing the page resets to seed data. There is no localStorage, no backend sync. This is a known limitation awaiting backend integration.

**Seed data is hardcoded:**
Every time AppStoreProvider mounts (once at app start), seed data is re-created. This is intentional but means the sample data is static and not customizable without editing the source code.

**Delete clears selection automatically:**
When `deleteResume(id)` is called, it checks if the deleted ID matches `selectedResumeId`. If so, it clears it. This prevents orphaned selections but means callers don't need to manually clear selection. However, pages still render deletion flow and show empty state, so the UX is correct.

**No validation of content:**
`addJob(content: string)` accepts any string, including empty. The Jobs page validates before calling addJob (checks `draft.trim()` before submit), but the store itself does not validate.

**Context throws, not returns undefined:**
Unlike some patterns, `useAppStore()` throws if outside provider. This is strict but prevents silent failures. It forces proper provider setup.

**Type: Item is generic:**
Resumes and jobs use the same `Item` type. This works because both have `id`, `name`, and `content`. If they diverge (e.g., jobs need a URL field, resumes need a format field), separate types should be created and Store should use `Job extends Item, Resume extends Item`.

## Open Questions

- Should sample data be configurable or fetched from an API?
- Should selection persist to URL (e.g., `/resumes?id=r123`) for shareable links?
- Should addJob validate content length or format?
- Should resumes be parsed on upload (currently noted as "mock")?
