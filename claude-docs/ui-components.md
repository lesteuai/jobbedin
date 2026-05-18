# UI Components & Design System

## Purpose

The UI component library under `components/ym/` provides a cohesive Yahoo Messenger (2000s) design aesthetic across all pages. Components are stateless, styling-driven primitives that enforce a consistent visual language and interaction model.

## Location

- `components/ym/` — All Yahoo Messenger UI primitives
  - `AppFrame.tsx` — Main app shell
  - `YmButton.tsx` — Styled button with variants
  - `YmModal.tsx` — Modal dialog with confirm/cancel
  - `Sidebar.tsx` — List management sidebar
  - `MarkdownPanel.tsx` — Content renderer
- `app/globals.css` — All CSS for the design system (300+ lines)

## Entry Points

- `components/ym/AppFrame.tsx` — Wraps every app-interior page with titlebar and sign-out button
- `components/ym/YmButton.tsx` — Use for all interactive buttons
- `components/ym/YmModal.tsx` — Use for confirmation dialogs or blocking modals
- `components/ym/Sidebar.tsx` — Use for list-based navigation (resumes/jobs)
- `components/ym/MarkdownPanel.tsx` — Use for rendering formatted text content

## Architecture / Key Components

### AppFrame
Provides the app shell with:
- Full-height flexbox container (matches Yahoo Messenger main window)
- Title bar with app name and window control buttons (_, ▭, ×)
- Sign Out button (top right, overlaid via absolute positioning)
- Transparent sign-out button (no click handlers yet; placeholder)
- Router-aware: uses `useRouter()` for navigation

**Props:** `{ children: ReactNode }`

### YmButton
Styled button with two variants:
- `variant="default"` — Light gray 3D beveled button (Windows XP style)
- `variant="primary"` — Purple gradient button with white text

**Props:**
```tsx
{
  variant?: "default" | "primary";
  className?: string;
  ...HTMLButtonAttributes
}
```

Uses clsx to merge custom className with variant styles. Can be disabled; disabled state grays text and reduces opacity.

### YmModal
Blocking dialog with confirm/cancel buttons:
- Overlay with dark semi-transparent background (rgba 0 0 0 / 0.35)
- Centered window (360px wide)
- Title bar with warning icon
- Body content (ReactNode)
- Footer with OK and Cancel buttons (customizable labels)
- Click outside overlay cancels (stopPropagation on modal content)

**Props:**
```tsx
{
  open: boolean;
  title?: string;
  children: ReactNode;
  okLabel?: string;
  cancelLabel?: string;
  onOk: () => void;
  onCancel: () => void;
}
```

### Sidebar
Reusable list-based navigation panel (200px wide):
- Header (optional) — e.g., back button
- Title with section label and star icon
- Primary button for adding items
- Scrollable list of items with delete buttons
- Footer (optional) — e.g., secondary navigation

**Props:**
```tsx
{
  title: string;
  addLabel: string;
  onAdd: () => void;
  items: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  header?: ReactNode;
  footer?: ReactNode;
}
```

Items render as `.ym-listitem` with:
- Flex row (icon + name + delete button)
- Click to select (background highlight + purple gradient)
- Hover state (light purple background)
- Delete button (red ×) with event.stopPropagation()

### MarkdownPanel
Renders markdown content via react-markdown:
- Inset panel (white background, 3D border)
- Scrollable container
- Custom CSS classes for h1–h6, p, ul, ol, code, strong, em, hr, a
- Markdown styling defined in `app/globals.css` under `.ym-md` classes

**Props:** `{ children: string }`

## Data Flow

**Component tree (typical page):**
```
AppFrame
├── Sidebar (resumes/jobs list)
│   ├── header (optional navigation)
│   ├── title + add button
│   └── items (list + delete)
└── Main content area (flex: 1)
    ├── Empty state (no selection)
    ├── MarkdownPanel (preview/description)
    ├── YmButton (action buttons)
    └── YmModal (confirmation, if open)
```

**Interaction flow:**
1. User clicks item in Sidebar → onSelect callback
2. Parent page updates selectedId via context
3. Component re-renders, highlighting active item
4. Parent page shows content panel matching selection
5. Delete button → onDelete callback → modal (optional) → context update

## Dependencies

**Internal:**
- `app/globals.css` — All styling via CSS classes
- React hooks: useState, useRouter, ReactNode
- Components are stateless (no local state); parents handle it

**External:**
- `react-markdown@10.1.0` — MarkdownPanel dependency
- `clsx@2.1.1` — Class name utilities in YmButton
- No other UI libraries (no shadcn, no Material-UI, etc.)

## Consumers

- `app/resumes/page.tsx` — Uses AppFrame, Sidebar, YmButton, YmModal, MarkdownPanel
- `app/jobs/page.tsx` — Uses AppFrame, Sidebar, YmButton, YmModal, MarkdownPanel, custom chat UI
- `app/page.tsx` (login) — Uses YmButton and hand-rolled login form (no Sidebar/AppFrame)

## Patterns & Conventions

**Styling approach:**
- No CSS modules; all styles in `app/globals.css`
- Inline styles for layout (flexbox properties, sizing, positioning)
- Class names for visual states (`.ym-btn`, `.ym-btn:hover`, `.ym-btn:active`, `.ym-btn-primary`)
- Data attributes for conditional styling: `data-active="true"` triggers `.ym-listitem[data-active="true"]`

**Component API:**
- All components are presentational (React.FC or function components)
- No refs; all interaction via callbacks
- Props are minimal and focused (no "catch-all" prop objects)
- Optional props use destructuring with defaults (e.g., `variant = "default"`)

**CSS class structure:**
```
.ym-<primitive>           -- Base class
.ym-<primitive>-<variant> -- Variant (e.g., .ym-btn-primary)
.ym-<primitive>:hover     -- Interactive state
.ym-<primitive>:active    -- Pressed state
[data-active="true"]      -- Data attribute for JS-driven state
```

**Re-usability:**
- YmButton is the only button element used app-wide
- Sidebar is used for both resumes and jobs (type-safe via TypeScript)
- MarkdownPanel is the canonical content renderer
- AppFrame is the app shell for all interior pages (not login)

## Gotchas & Non-Obvious Logic

**Modal click-outside behavior:**
The YmModal applies `onClick={onCancel}` to the overlay. The modal content itself calls `stopPropagation()` to prevent overlay clicks from bubbling. This is a standard pattern but worth noting if adding nested clickable elements inside the modal.

**Sidebar item icon:**
All items render with a 📄 emoji prefix (hardcoded in Sidebar.tsx). This is intentional for consistency but means item icons are not customizable. If different icons are needed (e.g., 💼 for jobs), the Sidebar component must be updated to accept an `icon` prop.

**List item rendering:**
Sidebar uses `items.map((it) => ...)` without a key prop. React infers it from array index. This is safe because items are not reordered in-flight; however, if items become dynamic (drag-drop, reordering), a unique `id` should be added as the key.

**Window buttons non-functional:**
AppFrame and YmModal render window control buttons (_, ▭, ×) for visual authenticity, but they have no click handlers. They are read-only UI elements. If window control is needed, add onClick handlers and state.

**Default modal title:**
YmModal defaults to title="JobbedIn" if not provided. Every modal should override this to something descriptive (e.g., "Confirm delete").

## Open Questions

- Should Sidebar accept a custom icon prop per item to support different emoji/icons?
- Should MarkdownPanel support custom CSS class overrides?
- Is the window chrome (buttons in AppFrame/YmModal) intended to be interactive in the future?
