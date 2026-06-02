# Conventions & Patterns

## Naming Conventions

**Component files:** PascalCase
- `YmButton.tsx`, `AnalysisReport.tsx`, `ChatPanel.tsx`

**React Context:** `Ctx` internally, exported as `use<Name>` hooks
- Internal: `const StoreCtx = createContext<Store>(null)`
- Export: `export function useAppStore() { return useContext(StoreCtx) }`

**Event handlers:** Prefix with `handle`
- `handleSubmit()`, `handleSelect()`, `handleSend()`, `handleClear()`

**State types:** Named by scope (discriminated unions)
- `type Mode = 'letter' | 'message'`
- `type View = 'list' | 'view'`
- `type Tab = 'company' | 'jdMatch' | 'feedback' | 'generate'`

**CSS classes:** Prefixed with `ym-` for Yahoo Messenger design system
- `.ym-btn`, `.ym-input`, `.ym-panel`, `.ym-btn--active`

## Code Organization

**Pages:** Live in app router directories, not colocated with components
- `app/page.tsx` (login)
- `app/resumes/page.tsx` (resume list)
- `app/resumes/[id]/page.tsx` (job analysis hub)

**UI Primitives:** Isolated under `app/components/ym/`
- `AppFrame.tsx`, `YmButton.tsx`, `ChatPanel.tsx`, `Sidebar.tsx`, `YmModal.tsx`, `MarkdownPanel.tsx`

**Composite Components:** Live in `app/components/` (not ym/)
- `AnalysisReport.tsx` (page-level composition)

**Utilities & State:** `app/lib/`
- `api-handler.ts`, `app-store.tsx`, `auth/`, `db/`, `workflow.ts`, `system-prompt.ts`, `utils.ts`

**Hooks:** `app/hooks/`
- `use-chat.ts`, `use-mobile.tsx`

**LLM Prompts:** All centralized in `app/lib/system-prompt.ts`
- Never define prompts inline in routes or workflow nodes
- Import prompts to enable reuse between workflow and chat refinement

**Database:** Isolated in `app/lib/db/`
- `schema.ts` (Drizzle table definitions)
- `index.ts` (PostgreSQL client + Drizzle initialization)

**Sample data:** Defined as constants near where used
- `SAMPLE_RESUME`, `SAMPLE_JOB`, `MOCK`, `SEED`, `PLACEHOLDER`

## React Patterns

**Use client:** All pages and interactive components must have `'use client'` directive
- Pages in app router
- Components with hooks (useState, useEffect, useContext)
- Never use server components

**Context consumption:** Via `useAppStore()` hook; throws if outside provider
```typescript
const store = useAppStore();  // Throws if not wrapped by AppStoreProvider
```

**Local state:** Form inputs, modal visibility, view modes kept in component
```typescript
const [draft, setDraft] = useState('');
const [isLoading, setIsLoading] = useState(false);
```

**No prop drilling:** Context for cross-page concerns only
- Use context for: resumes, jobs, selectedJob, CRUD operations
- Avoid props for: UI state that's only needed in one component

**Controlled inputs:** All inputs use onChange handlers
```typescript
<textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
```

## Styling Patterns

**Inline styles:** For layout (flexbox, positioning, sizing)
```jsx
<div style={{ display: 'flex', padding: '1rem', gap: '0.5rem' }}>
```

**Class names:** For theming and state-dependent styles
```jsx
<button className={`ym-btn ${isActive ? 'ym-btn--active' : ''}`}>
```

**Data attributes:** For conditional styling
```jsx
<div data-active={isSelected}>...</div>
```

**CSS variables:** All colors defined in :root, referenced via vars
```css
background-color: var(--color-primary);
```

## Type Safety

**Strict TypeScript mode:** Enabled in tsconfig.json

**Type definitions:** Colocated with their use
- `Item` and `Store` in app-store.tsx
- `Mode`, `ChatLine` in use-chat.ts
- `Tab` in AnalysisReport.tsx

**HTML5 semantics:** Preferred where possible
- `<button>`, `<form>`, `<input>`, `<textarea>`
- Fallback to `<div>` for layout/styling only

## Authentication (better-auth)

**Session validation:** All API routes must validate before accessing data
```typescript
const session = await auth.api.getSession({ headers: request.headers });
if (\!session) return new Response('Unauthorized', { status: 401 });
```

**userId scoping:** All database queries must filter by userId
```typescript
const data = await db.query.resumes.findMany({
  where: eq(schema.resumes.userId, session.user.id),
});
```

**No middleware route protection:** Pages are public; API-level validation is security boundary

**Sign-out:** Call `authClient.signOut()` on frontend, then `clearStore()` to reset state

## Keyboard Interaction

Yahoo Messenger design expects keyboard-friendly navigation:
- No buttons disabled by default (except on form validation failure)
- Tab order implicit (DOM order)
- In chat input: Enter sends, Shift+Enter for newline

## Comment Guidelines

**Default: No comments.** Code should be self-explanatory via clear naming.

**Add one-line comments only when:**
- Why is non-obvious (hidden constraint, subtle invariant)
- Workaround for specific bug
- Behavior that would surprise a reader

**Never write:**
- Multi-paragraph docstrings
- Comments explaining WHAT the code does (that's what clean names are for)
- Comments referencing tasks/issues (belongs in PR description, not code)
