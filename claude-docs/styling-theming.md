# Styling & Theming

## Purpose

JobbedIn uses a cohesive Yahoo Messenger (2000s) design system for all UI. The entire visual language is defined in `app/globals.css` using CSS variables, gradients, and a consistent naming convention. This document explains the color system, CSS organization, and how to extend or modify the theme.

## Location

- `app/globals.css` — 300+ lines of CSS (base styles, Yahoo Messenger primitives, component styles)
- Component classes prefixed with `ym-` throughout
- Inline styles in components for layout (flexbox) and sizing
- No CSS modules; all styles are global

## Entry Points

- Import `app/globals.css` in `app/layout.tsx` (done)
- Use `ym-` class names in components
- Override specific styles with inline `style={}` props where needed

## Architecture / Key Components

### CSS Variables (Root)

```css
:root {
  /* Light backgrounds for UI chrome */
  --ym-window: oklch(0.93 0.005 90);      /* Main window background */
  --ym-panel: oklch(0.97 0.005 90);       /* Sidebar background */
  --ym-inset: oklch(0.99 0.003 90);       /* Input/content panel background */

  /* Title bar gradient */
  --ym-titlebar-from: oklch(0.45 0.18 295);   /* Deep purple */
  --ym-titlebar-to: oklch(0.55 0.20 270);     /* Purple-blue */

  /* Accent colors */
  --ym-accent: oklch(0.55 0.22 295);      /* Yahoo purple (primary) */
  --ym-accent-2: oklch(0.65 0.20 30);     /* Orange-yellow (secondary) */

  /* Text and state */
  --ym-text: oklch(0.18 0.02 280);        /* Dark text */
  --ym-muted: oklch(0.45 0.02 280);       /* Muted text for disabled/secondary */
  --ym-danger: oklch(0.55 0.22 27);       /* Red for delete/danger actions */

  /* Typography */
  --ym-font: Tahoma, "MS Sans Serif", Geneva, Verdana, sans-serif;
}
```

**Color space:** OKLch (perceptually uniform, modern)
- L (lightness): 0–1
- C (chroma): saturation-like value
- h (hue): 0–360 degrees

**Palette strategy:**
- Purples dominate (Yahoo brand, circa 2005)
- Neutral grays for UI chrome (window, panel, inset)
- Orange accent for secondary actions
- Red for destructive actions
- No color hardcoding; all values use variables

### Base Styles

```css
@layer base {
  html, body, #root { height: 100%; }
  body {
    background: repeating-linear-gradient(45deg, ...);
    color: var(--ym-text);
    font-family: var(--ym-font);
    font-size: 12px;
  }
}
```

- Body has a subtle diagonal stripe pattern (XP-style desktop)
- Fixed 12px font size (small, dense, retro)
- Tahoma/MS Sans Serif as primary font
- Assumes full-height viewport

### Component Primitives (.ym-*)

**Window:**
```css
.ym-window {
  background: var(--ym-window);
  border: 1px solid oklch(0.25 0.05 285);
  border-radius: 6px 6px 4px 4px;
  box-shadow: inset 0 0 0 1px oklch(0.98 0.005 90), 0 6px 20px rgba(...);
}
```
- Light background with 1px border
- Rounded top corners, square bottom (mimics XP window)
- Double shadow: inner highlight + outer drop shadow (3D effect)

**Title bar:**
```css
.ym-titlebar {
  background: linear-gradient(180deg, var(--ym-titlebar-from) 0%, ...);
  color: white;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.4);
  font-weight: bold;
  font-size: 12px;
}
```
- Purple gradient from top to bottom
- White text with dark shadow (readable on gradient)
- Used on modal, app frame, sidebar headers

**Buttons:**

Default variant:
```css
.ym-btn {
  background: linear-gradient(180deg, #fefefe 0%, #d6d2c2 100%);
  border-top: 1px solid #fff;
  border-left: 1px solid #fff;
  border-right: 1px solid #555;
  border-bottom: 1px solid #555;
}
.ym-btn:hover { background: linear-gradient(180deg, #ffffff 0%, #e5dfc8 100%); }
.ym-btn:active { border-top: 1px solid #555; border-left: 1px solid #555; ... }
```
- Light gray gradient (3D beveled XP button)
- Bright borders on top/left (highlight), dark on right/bottom (shadow)
- Active state inverts border colors (pressed effect)

Primary variant:
```css
.ym-btn-primary {
  background: linear-gradient(180deg, oklch(0.7 0.18 295) 0%, oklch(0.4 0.2 295) 100%);
  color: white;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.4);
  font-weight: bold;
  border-top: 1px solid oklch(0.8 0.1 295);
  border-left: 1px solid oklch(0.8 0.1 295);
  border-right: 1px solid oklch(0.2 0.1 295);
  border-bottom: 1px solid oklch(0.2 0.1 295);
}
```
- Purple gradient (Yahoo brand)
- White text with shadow
- Lighter borders on top/left, darker on right/bottom

**Inputs and textareas:**
```css
.ym-input, .ym-textarea {
  background: white;
  border-top: 1px solid #888;
  border-left: 1px solid #888;
  border-right: 1px solid #fff;
  border-bottom: 1px solid #fff;
  padding: 4px 6px;
  outline: none;
}
.ym-input:focus, .ym-textarea:focus {
  outline: 1px dotted #444;
  outline-offset: -3px;
}
```
- White background with inset 3D borders
- Focus state: dotted outline inside (XP style)
- Small padding for compact density

**List items:**
```css
.ym-listitem {
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;
  border: 1px solid transparent;
}
.ym-listitem:hover {
  background: oklch(0.85 0.05 285 / 0.5);
}
.ym-listitem[data-active="true"] {
  background: linear-gradient(180deg, oklch(0.55 0.2 295) 0%, oklch(0.4 0.2 295) 100%);
  color: white;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.3);
}
```
- Transparent border by default (spacing)
- Hover: light purple tint
- Active (data-active="true"): purple gradient with white text

**Tabs:**
```css
.ym-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 8px 0 8px;
  border-bottom: 2px solid oklch(0.4 0.2 295);
}
.ym-tab {
  background: linear-gradient(180deg, #e8e4d4 0%, #c8c4b4 100%);
  border-top: 1px solid #888;
  border-left: 1px solid #888;
  border-right: 1px solid #555;
  border-bottom: none;
  border-radius: 5px 5px 0 0;
  cursor: pointer;
}
.ym-tab[data-active="true"] {
  background: linear-gradient(180deg, oklch(0.6 0.2 295) 0%, oklch(0.45 0.2 295) 100%);
  color: white;
  font-weight: bold;
  top: 0;
  padding-bottom: 6px;
}
```
- Folder-like appearance (rounded top only)
- Inactive: beige, semi-3D borders
- Active: purple gradient, bold white text
- No bottom border on active tab (continuity with content area)

**Modal overlay:**
```css
.ym-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
```
- Full-screen semi-transparent backdrop
- Flex centering of modal window

**Chat UI:**
```css
.ym-bubble-user {
  color: oklch(0.4 0.2 27);
  font-weight: bold;
}
.ym-bubble-ai {
  color: oklch(0.4 0.2 250);
  font-weight: bold;
}
.ym-chat-line {
  padding: 3px 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
```
- User messages: orange/red bold prefix
- AI messages: blue bold prefix
- Preserves whitespace and wraps long lines

**Markdown content:**
```css
.ym-md h1 { font-size: 18px; font-weight: bold; margin: 12px 0 6px; color: oklch(0.35 0.2 295); }
.ym-md h2 { font-size: 15px; font-weight: bold; margin: 10px 0 5px; color: oklch(0.4 0.2 295); }
.ym-md h3 { font-size: 13px; font-weight: bold; margin: 8px 0 4px; }
.ym-md p  { margin: 6px 0; line-height: 1.45; }
.ym-md ul { list-style: disc; padding-left: 22px; margin: 6px 0; }
.ym-md ol { list-style: decimal; padding-left: 22px; margin: 6px 0; }
.ym-md li { margin: 2px 0; }
.ym-md code { background: #eee; padding: 1px 4px; border: 1px solid #ccc; }
.ym-md strong { font-weight: bold; }
.ym-md em { font-style: italic; }
.ym-md a { color: oklch(0.45 0.2 250); text-decoration: underline; }
```
- Hierarchical heading sizes (18px → 15px → 13px)
- Purple headings (h1 darker, h2/h3 medium)
- Standard list and code styling
- Blue links

**Utility:**
```css
.ym-blur-placeholder::placeholder {
  filter: blur(1.2px);
  color: #888;
  font-style: italic;
}
```
- Placeholder text is blurred (de-emphasizes suggestions)

## Data Flow

**Color to component:**
```
:root variables (--ym-accent, etc.)
├─ .ym-titlebar (uses --ym-titlebar-from, --ym-titlebar-to)
├─ .ym-btn-primary (uses oklch hardcoded, not variable)
├─ .ym-listitem[data-active] (uses oklch hardcoded)
└─ .ym-md a (uses oklch hardcoded)
```

Note: Not all colors are variables yet. Primary buttons and active list items use hardcoded OKLch values. Refactoring to use variables would improve consistency.

## Dependencies

**Internal:**
- `app/globals.css` imported in `app/layout.tsx`
- Tailwind CSS v4 imported via `@import "tailwindcss";` (PostCSS plugin)
- All components reference `ym-` classes

**External:**
- PostCSS (processes @import and other directives)
- Tailwind CSS v4 (provides base styles, utilities, if needed)

## Patterns & Conventions

**CSS organization:**
1. CSS variables (:root)
2. @layer base (reset, body styles)
3. Primitives (.ym-window, .ym-btn, .ym-input, etc.)
4. Component-specific (.ym-tab, .ym-listitem, .ym-chat-line, etc.)
5. Content-specific (.ym-md h1, etc.)

**Naming convention:**
- `.ym-<primitive>` — Base primitive (window, button, panel)
- `.ym-<primitive>-<variant>` — Variant (btn-primary)
- `.ym-<primitive>:<state>` — Hover, active, focus
- `[data-active="true"]` — JS-driven state

**Border strategy (3D beveling):**
```
border-top:    light (#fff or bright)     → highlight
border-left:   light (#fff or bright)     → highlight
border-right:  dark (#555 or dark)        → shadow
border-bottom: dark (#555 or dark)        → shadow
```
This pattern (consistent across buttons, inputs, panels) creates the XP 3D effect.

**Gradient patterns:**
- Buttons: vertical linear gradient (top bright, bottom darker)
- Title bar: vertical gradient (purple to blue-purple to purple)
- Active tab: vertical gradient (light purple to dark purple)

**Color palette usage:**
- Backgrounds: oklch(0.93–0.99) — very light, high lightness
- Borders/shadows: oklch(0.25–0.55) — mid to dark
- Text: oklch(0.18) — very dark
- Accents: oklch(0.55–0.65) — saturated, mid lightness

## Gotchas & Non-Obvious Logic

**OKLch vs. RGB:**
All custom colors use OKLch instead of hex or RGB. This is more modern but less familiar. OKLch values are visual (lightness, saturation, hue) rather than channel-based. To modify a color, adjust the L (lightness) or h (hue) slightly; C (chroma/saturation) controls intensity.

**Inset shadows for depth:**
Window elements use `inset 0 0 0 1px` for inner highlights. This creates a subtle inner glow. The outer `0 6px 20px rgba(0,0,0,0.35)` creates drop shadow. Together, they make flat surfaces appear 3D.

**Button active state border inversion:**
Active buttons swap border colors:
- Normal: bright top/left, dark right/bottom
- Active: dark top/left, bright right/bottom

This is the key to the "pressed" effect. If you remove or modify this, buttons won't feel clickable.

**Focus outline is inside, not outside:**
```css
outline: 1px dotted #444;
outline-offset: -3px;
```
The negative offset moves the outline inside the element. This is XP style but unusual; modern apps use outside focus rings. Changing outline-offset to 0 would move it outside (more visible but less retro).

**List item transparent border:**
```css
border: 1px solid transparent;
```
Even when not hovered/active, list items have a transparent border. This prevents the text from shifting when the background changes. Otherwise, hover would add 1px of space, moving text slightly.

**Markdown heading colors don't use variables:**
`.ym-md h1, h2, h3` use hardcoded OKLch values instead of CSS variables. If the primary accent color changes, these won't update automatically. This is a refactoring opportunity.

**Tab active state uses position: relative; top:**
```css
.ym-tab[data-active="true"] {
  top: 0;
  padding-bottom: 6px;
}
```
Inactive tabs have `position: relative; top: 1px;` (not shown in excerpt). This makes active tabs 1px taller, appearing to extend down and overlap the content area. It's a pure CSS trick to simulate the folder metaphor.

## Open Questions

- Should all hardcoded colors be refactored to CSS variables?
- Should outline-offset change for better modern accessibility?
- Should markdown headings use --ym-accent instead of hardcoded values?
- Should a light/dark mode theme be supported? (Would require JS to switch variables)
