# Styling & Theming

## Color System (OKLch)

The color palette uses OKLch color space for precise control. This allows perceptually uniform colors across different brightness levels.

All colors are defined as CSS variables in `:root` in `app/globals.css`.

**Yahoo Messenger color definitions (from `:root`):**
```css
--ym-window: oklch(0.93 0.005 90);          /* Main window background */
--ym-panel: oklch(0.97 0.005 90);           /* Panel background */
--ym-inset: oklch(0.99 0.003 90);           /* Sunken/inset areas */
--ym-titlebar-from: oklch(0.45 0.18 295);   /* Deep purple */
--ym-titlebar-to: oklch(0.55 0.20 270);     /* Purple-blue */
--ym-accent: oklch(0.55 0.22 295);          /* Yahoo purple */
--ym-accent-2: oklch(0.65 0.20 30);         /* Orange-y */
--ym-text: oklch(0.18 0.02 280);            /* Dark text */
--ym-muted: oklch(0.45 0.02 280);           /* Muted text */
--ym-danger: oklch(0.55 0.22 27);           /* Error red */
--ym-font: Tahoma, "MS Sans Serif", ...     /* System font */
```

## CSS Organization

`app/globals.css` contains:
- CSS custom properties (color, spacing, typography)
- Yahoo Messenger design system primitives
- Component base styles (`.ym-btn`, `.ym-input`, `.ym-panel`, etc.)
- Responsive breakpoints
- Transition and animation keyframes

**Line count:** 300+ lines (primitives only; no utility classes, those come from Tailwind v4)

## Styling Patterns

### Inline Styles
Used for layout and positioning:
```jsx
<div style={{ display: 'flex', padding: '1rem', gap: '0.5rem' }}>
  {children}
</div>
```

### Class Names
Used for theming and state-dependent styles:
```jsx
<button className={`ym-btn ${isActive ? 'ym-btn--active' : ''}`}>
  Click
</button>
```

Data attributes for state:
```jsx
<button data-active={isSelected}>Select</button>
```

### Tailwind CSS v4
No custom utilities defined; relies on built-in Tailwind classes for responsive design.

Configured in `postcss.config.mjs` with `@tailwindcss/postcss` plugin.

## Design Tokens

**Spacing (inline styles and Tailwind):**
- Typically 4px, 8px, 12px, 16px increments for consistency
- Layout uses flexbox with gap property

**Typography:**
- Base font size: 12px (Yahoo Messenger era)
- Font family: Tahoma, "MS Sans Serif", Geneva, Verdana, sans-serif
- Headings use fontWeight bold with explicit fontSize

**Border radius:**
- Subtle: 2px (buttons, inputs)
- Normal: 4px (window corners)
- Rounded: 6px (top window corners)

**Shadows:**
- Window: inset highlight + outer drop shadow
- Buttons: 3D beveled effect with border colors
- No smooth drop shadows; all effects via borders and gradients

**Gradients:**
- All gradients are linear, typically 180deg (top to bottom)
- Used extensively on buttons, title bars, and tab controls
- Colors reference CSS variables

## Responsive Design

Handled via Tailwind CSS v4 responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`).

No CSS breakpoints defined manually; inherited from Tailwind defaults.

## Color Usage Patterns

**In CSS (globals.css):**
Colors referenced via CSS variables. Gradients use oklch() directly for precise control.

**In React components:**
- Inline styles for dynamic backgrounds, borders, text colors
- Class names for static theming (`.ym-btn`, `.ym-window`, etc.)
- Data attributes for state-based colors (`data-active`, etc.)

Most color values are oklch() literals in globals.css; only referenced via var() in actual component styles.

Example from globals.css:
```css
.ym-btn {
  background: linear-gradient(180deg, #fefefe 0%, #d6d2c2 100%);
  color: #000;
}
.ym-btn-primary {
  background: linear-gradient(180deg, oklch(0.7 0.18 295) 0%, oklch(0.4 0.2 295) 100%);
  color: white;
}
```
