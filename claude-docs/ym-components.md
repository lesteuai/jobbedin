# Yahoo Messenger Components

## Purpose

Custom, reusable UI components styled to evoke Yahoo Messenger (circa 2002-2005). These components provide the visual foundation for the entire app: window chrome, buttons, sidebars, modals, and markdown rendering. They are independent of business logic and fully presentational.

## Location

`src/components/ym/` — Five component files
- `AppFrame.tsx` — Full-screen window container with titlebar and sign-out button
- `Sidebar.tsx` — Left sidebar panel with item list, add button, and delete buttons
- `YmButton.tsx` — Reusable 3D beveled button
- `YmModal.tsx` — Confirmation dialog
- `MarkdownPanel.tsx` — Markdown content renderer

## Entry Points

**Route components import and compose these:**

- `src/routes/__root.tsx` — ErrorComponent and NotFoundComponent use AppFrame, YmButton, YmModal
- `src/routes/index.tsx` — LoginPage uses inline YmButton and styles (no ym-* components)
- `src/routes/resumes.tsx` — Composes AppFrame, Sidebar, YmModal, YmButton, MarkdownPanel
- `src/routes/jobs.tsx` — Composes AppFrame, Sidebar, YmButton, YmModal, MarkdownPanel, and manages internal chat UI with .ym-* CSS classes

## Architecture / Key Components

**AppFrame**

Container for full-screen app layout. Renders:
- Outer div with flex layout (min-height 100vh)
- Inner div with `ym-window` class (full width, applies 3D window styling)
- Titlebar with "☺ JobbedIn" and decorative minimize/maximize/close buttons
- "Sign Out" button (top-right, absolute positioned, navigates to /)
- `<Outlet />` rendered inside flex container (children)

Props: `{ children: ReactNode }`

**Sidebar**

Reusable left panel component. Renders:
- Title bar with star emoji and uppercase label (e.g., "★ RESUMES")
- Primary action button (e.g., "+ Add resume" or "+ Add job")
- Scrollable list of items, each with:
  - Icon emoji (📄)
  - Item name
  - Red "×" delete button
  - Hover and active states via `data-active` attribute
- Optional `header` and `footer` slots (used in jobs route for "← Back to Resumes")

Props:
```typescript
{
  title: string
  addLabel: string
  onAdd: () => void
  items: { id: string; name: string }[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  header?: ReactNode
  footer?: ReactNode
}
```

**YmButton**

Generic button component. Extends HTMLButtonElement attributes. Props:
- `variant?: "default" | "primary"` — "primary" adds `.ym-btn-primary` class for purple gradient fill
- Spreads all HTML button attributes (onClick, disabled, type, style, etc.)

Renders: `<button className={`ym-btn ${variant === 'primary' ? 'ym-btn-primary' : ''} ${className}`} {...rest} />`

**YmModal**

Confirmation dialog. Renders:
- Overlay div with `.ym-modal-overlay` (semi-transparent backdrop, centered layout)
- Window div with titlebar (⚠ icon + title)
- Content div with children
- Footer with OK and Cancel buttons (both YmButton, OK is primary)

Props:
```typescript
{
  open: boolean
  title?: string
  children: ReactNode
  okLabel?: string
  cancelLabel?: string
  onOk: () => void
  onCancel: () => void
}
```

Returns null if not open (declarative).

**MarkdownPanel**

Simple wrapper for react-markdown. Renders markdown in a scrollable inset panel.

Props: `{ children: string }` (markdown string)

Wraps content in `.ym-inset ym-md` div with flex: 1 and overflow: auto, then passes to `<ReactMarkdown />`.

## Data Flow

**Typical screen composition:**

```
AppFrame (provides window chrome)
  ↓
Sidebar (left navigation)
Sidebar + main content area (flex row)
  ↓
Detail/empty state rendered in main pane
```

**User interaction example (delete resume):**

```
User clicks "×" on resume in Sidebar
  ↓
Sidebar's onDelete callback fires
  ↓
Route component (resumes.tsx) sets pendingDelete state
  ↓
YmModal opens with confirmation
  ↓
User clicks OK
  ↓
Route calls deleteResume from useAppStore
  ↓
Store updates state, component re-renders
```

## Patterns & Conventions

**Styling**

- All CSS classes begin with `.ym-*` (defined in src/styles.css)
- Components accept inline `style` prop for override (e.g., width, padding)
- No component-scoped CSS or CSS modules; all shared via Tailwind + global CSS

**Event Handling**

- Event callbacks named `on*` (onClick, onSelect, onDelete, onOk, onCancel)
- Handlers passed as props; components are fully controlled
- Modal's overlay div has onClick handler to close modal; child div has stopPropagation

**Composition**

- Components are presentational only; no state management beyond rendering
- Sidebar doesn't know about add/delete logic; parent route handles it
- YmButton is a thin wrapper; no internal state, no event logic

**Accessibility**

- Buttons have type and onClick handlers
- Modal overlay allows clicking outside to close (via onClick)
- Focus styling uses dotted outline (CSS `.ym-input:focus` and `.ym-textarea:focus`)
- No ARIA labels or semantic HTML roles yet (future work)

## Gotchas & Non-Obvious Logic

- **Sidebar's delete button uses stopPropagation**. Clicking the red "×" prevents the list item's onClick from firing (which would select the item). Without this, deleting an item would also select it.
- **Modal overlay click closes modal**. Clicking the semi-transparent overlay (outside the modal window) calls onCancel. This is intentional but non-standard; most apps require explicit Cancel button click.
- **AppFrame's sign-out button is decorative positioning**. Uses `position: absolute; top: 32px; right: 8px; z-index: 10` to float above the main content. Z-index ensures it appears above modals (z-index: 50) is not beaten.
- **YmButton doesn't validate disabled state by default**. Parent must manage disabled prop; button will still render and respond to clicks if disabled is false even if parent logic suggests it should be disabled.
- **MarkdownPanel doesn't sanitize HTML**. React-markdown renders user input; XSS is theoretically possible if untrusted markdown is passed (though markdown-only input is safe). Future work: add security review.
- **Sidebar's active state is CSS-driven**. The `.ym-listitem[data-active="true"]` selector styles active items. Parent must pass correct `selectedId` prop for visual sync.

## Consumers

- **AppFrame**: Used in __root.tsx (error/notfound pages), resumes.tsx, jobs.tsx
- **Sidebar**: Used in resumes.tsx, jobs.tsx (jobs.tsx uses it twice: once for jobs list, once implicitly in error layouts)
- **YmButton**: Used everywhere; nearly every interactive element is a YmButton
- **YmModal**: Used in resumes.tsx and jobs.tsx for delete confirmation
- **MarkdownPanel**: Used in resumes.tsx (detail), jobs.tsx (job description, analysis tabs)

## Open Questions

- Should YmButton support loading state (spinner, disabled while async operation pending)?
- Should Sidebar support collapsing or resizing?
- Should MarkdownPanel support syntax highlighting for code blocks?
- Should YmModal have a "loading" state for async confirmations?
- Should components accept className prop for Tailwind customization, or keep CSS classes fixed?
