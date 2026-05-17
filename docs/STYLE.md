# Design Style Guide

Extracted from the NextForge reference UI. Apply consistently across the SaaS app.

---

## Color Palette

| Role | Value | Usage |
|---|---|---|
| Background (app shell) | `#000000` | Sidebar, topbar, outer chrome |
| Background (content) | `#ffffff` | Cards, main content panels |
| Background (card) | `#ffffff` | Email preview card |
| Border | `#e5e7eb` | Card edges, dividers |
| Text primary | `#111827` | Headlines, body copy |
| Text secondary | `#6b7280` | Footer disclaimers, meta info |
| Accent / link | `#2563eb` | Hyperlinks, inline URLs |
| CTA background | `#111827` | Primary button fill |
| CTA text | `#ffffff` | Primary button label |

---

## Typography

- **Font family**: System sans-serif stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
- **Headline**: `~28–32px`, weight `700` (bold), color `#111827`
- **Body**: `~16px`, weight `400`, line-height `1.6`, color `#111827`
- **Meta / footer**: `~13–14px`, weight `400`, color `#6b7280`
- **Inline emphasis**: `font-weight: 700` on names, brand names, and key terms within body copy
- **Links**: `color: #2563eb`, no underline by default

---

## Layout

- **Two-column shell**: narrow sidebar (~260px) on the left, content area fills the rest
- **Topbar**: full-width, `~48px` tall, centered page title, icon group + action button on the right
- **Content card**: centered horizontally, max-width `~640px`, generous vertical padding (`48px top/bottom`, `40px left/right`), `border-radius: 8px`, subtle `box-shadow`
- **Card inner spacing**: `~24px` between major sections, `16px` between paragraphs
- **Horizontal rule**: `1px solid #e5e7eb` used as a section divider inside cards

---

## Components

### Primary Button
- Background: `#111827`
- Text: `#ffffff`, `14–16px`, `font-weight: 600`
- Padding: `12px 24px`
- Border-radius: `6px`
- No border, no shadow
- Hover: slight opacity reduction (`opacity: 0.85`) or background lightens to `#374151`

### Sidebar
- Background: `#000000`
- Item text: `#d1d5db` (inactive), `#ffffff` (active)
- Active item: subtle left-border highlight or background `#1f2937`
- Icon + label layout, `14px` font

### Topbar
- Background: `#000000`
- Centered title: `#ffffff`, `14–16px`, `font-weight: 500`
- Right-side icon buttons: bordered (`border: 1px solid #374151`), `border-radius: 6px`, small padding

---

## Iconography

- Line-style icons, monochrome (`#ffffff` on dark backgrounds, `#374151` on light)
- Size: `16–20px`
- Used sparingly — only for navigation items and toolbar actions

---

## Spacing Scale

Based on a `4px` base unit:

| Token | Value |
|---|---|
| `xs` | `4px` |
| `sm` | `8px` |
| `md` | `16px` |
| `lg` | `24px` |
| `xl` | `40px` |
| `2xl` | `48px` |

---

## Visual Principles

- **High contrast shell**: pure black chrome against white content creates a sharp, focused reading area
- **Minimal decoration**: no gradients, no textures, no decorative illustrations
- **Content-first**: the card is the hero — all chrome recedes visually
- **Whitespace-heavy**: generous padding inside cards; sections breathe rather than stack tightly
- **Typographic hierarchy only**: hierarchy is expressed through weight and size, not color variation
- **Monochrome primary action**: the CTA button is black-on-white (inverted within the white card), avoiding colored accent buttons
