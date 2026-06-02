# Styling & Theming

## Color System (OKLch)

The color palette uses OKLch color space for precise control. This allows perceptually uniform colors across different brightness levels.

All colors are defined as CSS variables in `:root` in `app/globals.css`.

**Example color definition:**
```css
:root {
  --color-primary: okl(0.5 0.2 220);    /* Perceptual lightness, chroma, hue */
  --color-bg: okl(0.98 0 0);             /* Near-white background */
  --color-text: okl(0.2 0 0);            /* Dark text */
  --color-border: okl(0.8 0 0);          /* Light gray border */
}
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

**Spacing scale:**
- `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`, etc.

**Typography:**
- Base font size: 14px
- Heading scales: 16px, 18px, 20px
- Line height: 1.5 (readable)

**Border radius:**
- Subtle: 0.25rem
- Normal: 0.5rem
- Rounded: 1rem

**Transitions:**
- Fast: 150ms
- Normal: 300ms
- Slow: 500ms

**Shadows:**
- Subtle: `0 1px 2px rgba(0, 0, 0, 0.1)`
- Elevated: `0 4px 6px rgba(0, 0, 0, 0.15)`

All defined as CSS variables for consistent reuse.

## Responsive Design

Handled via Tailwind CSS v4 responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`).

No CSS breakpoints defined manually; inherited from Tailwind defaults.

## No Hardcoded Colors

Colors are always referenced via CSS variables, except in gradients (which are dynamic and require inline styles).

Example:
```css
background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
```
