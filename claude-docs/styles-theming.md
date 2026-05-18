# Styles & Theming

## Purpose

Define the visual identity of JobbedIn through a unified theming system. All styling is centralized in a single CSS file using Tailwind v4 and CSS custom properties (variables), enabling the Yahoo Messenger aesthetic: beveled 3D buttons, gradient titlebars, sunken panels, retro typography, and okLCH color space for perceptual uniformity.

## Location

`src/styles.css` — Single source of truth for all styling

Structure:
1. Tailwind imports and theme definition
2. Color variable definitions (`:root`)
3. Base layer styles (body, html, #root)
4. Component-level CSS classes (`.ym-*`)

## Entry Points

- **Main.tsx** imports `src/styles.css` directly: `import "./styles.css"`
- Vite processes CSS through Tailwind v4 (`@tailwindcss` directive) and custom property system
- All HTML elements use `.ym-*` class names defined in this file

## Architecture / Key Components

**Tailwind v4 Setup**

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... color mappings ... */
  --font-ym: var(--ym-font);
}
```

- `@source` directive tells Tailwind to scan `src/` for classes
- `@theme inline` maps CSS variables to Tailwind design tokens
- This allows using Tailwind utilities while keeping custom vars in sync

**Color Palette (okLCH space)**

```css
:root {
  /* Base */
  --background: oklch(0.92 0.01 280);     /* Light purple-tinted gray */
  --foreground: oklch(0.18 0.02 280);     /* Dark blue-gray text */

  /* Window chrome */
  --ym-window: oklch(0.93 0.005 90);      /* Light beige (#ECE9D8-ish) */
  --ym-panel: oklch(0.97 0.005 90);       /* Slightly lighter panel */
  --ym-inset: oklch(0.99 0.003 90);       /* Almost white sunken area */

  /* Accents */
  --ym-titlebar-from: oklch(0.45 0.18 295); /* Deep purple */
  --ym-titlebar-to: oklch(0.55 0.20 270);   /* Purple-blue */
  --ym-accent: oklch(0.55 0.22 295);        /* Yahoo purple (primary) */
  --ym-accent-2: oklch(0.65 0.20 30);       /* Orange-yellow secondary */
  --ym-danger: oklch(0.55 0.22 27);         /* Red for delete buttons */

  /* Text */
  --ym-text: oklch(0.18 0.02 280);        /* Dark text */
  --ym-muted: oklch(0.45 0.02 280);       /* Muted/placeholder text */

  /* Typography */
  --ym-font: Tahoma, "MS Sans Serif", Geneva, Verdana, sans-serif;
}
```

**okLCH Color Space**

- okLCH: Oklch(Lightness, Chroma, Hue)
  - Lightness (0–1): 0 = pure black, 1 = pure white
  - Chroma (0–∞): saturation intensity
  - Hue (0–360): color angle
- Perceptually uniform; same lightness value appears equally bright regardless of hue
- Preferred over RGB/HSL for accessible, predictable color scales

**Typography**

- Font stack: `Tahoma, "MS Sans Serif", Geneva, Verdana, sans-serif` (Windows XP-era system fonts)
- Base size: 12px (body font-size)
- No font-weight variation in base styles; bold applied selectively via `.ym-titlebar`, buttons, headers

## Component Styles

**Windows & Panels**

```css
.ym-window
  background: var(--ym-window)
  border: 1px solid oklch(0.25 0.05 285)
  border-radius: 6px 6px 4px 4px
  box-shadow: inset 0 0 0 1px oklch(0.98 0.005 90), 0 6px 20px rgba(0, 0, 0, 0.35)
```

Double border (inset white, outer dark) creates 3D effect. Drop shadow adds depth.

```css
.ym-panel
  background: var(--ym-panel)
  border-top/left: 1px solid #fff
  border-right/bottom: 1px solid #888
```

Beveled borders: light top-left, dark bottom-right = raised appearance.

```css
.ym-inset
  background: var(--ym-inset)
  border-top/left: 1px solid #888
  border-right/bottom: 1px solid #fff
```

Opposite bevel: appears sunken (list areas, text inputs, chat panels).

**Titlebar**

```css
.ym-titlebar
  background: linear-gradient(180deg, var(--ym-titlebar-from) 0%, var(--ym-titlebar-to) 55%, ...)
  color: white
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.4)
```

Gradient titlebar (purple to blue-purple) with text shadow for depth.

```css
.ym-titlebar-glow
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, ...)
  border-radius: 4px
```

White gradient overlay on titlebar for glossy effect.

**Buttons**

Default button (beveled 3D):
```css
.ym-btn
  background: linear-gradient(180deg, #fefefe 0%, #d6d2c2 100%)
  border-top/left: 1px solid #fff
  border-right/bottom: 1px solid #555
```

Light gradient with light top-left border, dark bottom-right = raised.

Primary button (purple gradient):
```css
.ym-btn-primary
  background: linear-gradient(180deg, oklch(0.7 0.18 295) 0%, oklch(0.4 0.2 295) 100%)
  color: white
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.4)
```

Purple gradient with white text for emphasis.

Active state (pressed):
```css
.ym-btn:active:not(:disabled)
  border-top/left: 1px solid #555
  border-right/bottom: 1px solid #fff
  background: linear-gradient(180deg, #c8c4b4 0%, #e0dcc8 100%)
```

Inverted borders and darker gradient = pushed-in appearance.

**Inputs & Textareas**

```css
.ym-input, .ym-textarea
  background: white
  border-top/left: 1px solid #888
  border-right/bottom: 1px solid #fff
  padding: 4px 6px
```

Sunken appearance (inset bevel). Focus ring:
```css
.ym-input:focus, .ym-textarea:focus
  outline: 1px dotted #444
  outline-offset: -3px
```

Dotted outline, inset, for retro focus indicator.

**List Items**

```css
.ym-listitem
  padding: 4px 8px
  color: var(--ym-text)
```

Hover:
```css
.ym-listitem:hover
  background: oklch(0.85 0.05 285 / 0.5)
```

Active:
```css
.ym-listitem[data-active="true"]
  background: linear-gradient(180deg, oklch(0.55 0.2 295) 0%, oklch(0.4 0.2 295) 100%)
  color: white
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.3)
```

Purple gradient with white text for selected item.

**Tabs**

Folder-tab style:
```css
.ym-tab
  background: linear-gradient(180deg, #e8e4d4 0%, #c8c4b4 100%)
  border-top/left: 1px solid #888
  border-right/bottom: 1px solid #555
  border-radius: 5px 5px 0 0
```

Active tab:
```css
.ym-tab[data-active="true"]
  background: linear-gradient(180deg, oklch(0.6 0.2 295) 0%, oklch(0.45 0.2 295) 100%)
  color: white
  top: 0  /* Raised effect */
  padding-bottom: 6px
```

Raised slightly above inactive tabs.

**Modal**

```css
.ym-modal-overlay
  position: fixed
  inset: 0
  background: rgba(0, 0, 0, 0.35)
  z-index: 50
```

Semi-transparent overlay, high z-index to appear above content.

**Chat & Markdown**

Chat bubbles:
```css
.ym-bubble-user
  color: oklch(0.4 0.2 27)     /* Orange */
  font-weight: bold

.ym-bubble-ai
  color: oklch(0.4 0.2 250)    /* Blue */
  font-weight: bold
```

Markdown styling (heading sizes, margins, link colors):
```css
.ym-md h1 { font-size: 18px; color: oklch(0.35 0.2 295); margin: 12px 0 6px; }
.ym-md p { margin: 6px 0; line-height: 1.45; }
.ym-md code { background: #eee; padding: 1px 4px; border: 1px solid #ccc; }
```

**Utility Classes**

```css
.ym-blur-placeholder::placeholder
  filter: blur(1.2px)
  color: #888
  font-style: italic
```

Chat input placeholder is blurred and italicized for a softer appearance.

## Patterns & Conventions

**CSS variables over hardcoded values**

- All colors stored in `:root` variables (--ym-*)
- Enables theme switching (future: dark mode, colorblind modes)
- Reduces duplication (e.g., purple used in multiple places references --ym-accent)

**Gradient + bevels for 3D effect**

- Every "raised" element (button, tab, window) has:
  - Light gradient top
  - Light border top-left
  - Dark border bottom-right
- Inverted for "sunken" elements (inputs, panels)

**Responsive utilities not heavily used**

- Tailwind utilities available (flex, gap, padding, etc.)
- Mostly inline styles for specific layouts
- No mobile-first breakpoint strategy yet (fixed 200px sidebar)

**Selector specificity**

- All selectors use class names (no element selectors beyond base)
- `.ym-btn:hover:not(:disabled)` pattern to exclude disabled buttons from hover effects
- Data attributes for state: `[data-active="true"]`, `[data-active="false"]`

## Gotchas & Non-Obvious Logic

- **okLCH syntax**. Format is `oklch(L C H)` where L and C are 0–1 (not 0–100). Hue is 0–360. Easy to confuse with hsl() syntax.
- **Border color hardcoding**. Some borders use hex colors (#888, #fff, #555) instead of variables. These are "system gray" colors chosen to match Windows XP. Future work: extract to variables for consistency.
- **No dark mode**. Custom variant `dark` is defined but never used. All colors assume light background.
- **Drop shadow on :root body background**. Body has a repeating linear gradient (diagonal pattern) as background, which creates a textured desktop feel. Very retro; may look odd on modern displays.
- **Font stack fallback**. System fonts (Tahoma, MS Sans Serif) may not exist on non-Windows systems. Falls back to Geneva, Verdana, sans-serif. Web fonts not used (intentional: keeping the "system UI" feel).
- **Outline-offset negative value**. Focus ring uses `outline-offset: -3px` to draw outline *inside* the element border. This is non-standard but works in modern browsers.
- **Text-shadow for depth**. White text on colored backgrounds uses `text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.4)` for a beveled/embossed effect. Reduces readability on some backgrounds.

## Open Questions

- Should there be CSS custom properties for spacing (gaps, padding) to enforce a consistent spacing scale?
- Should button sizes be standardized (e.g., `--button-height: 24px`)?
- Should there be a light/dark theme toggle using CSS variables?
- Should animations be added (fade-in, slide, etc.) using Tailwind's animation utilities?
- Should code blocks in markdown have syntax highlighting?
