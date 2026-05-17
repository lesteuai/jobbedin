# Yahoo Messenger (2000s) Design Reference

## Overview

Yahoo Messenger circa 2005-2008. A compact, desktop-native IM client running on Windows XP. The UI is dense and utility-first — every pixel earns its place. No whitespace padding for aesthetics.

---

## Color Palette

| Role | Color | Notes |
|---|---|---|
| Primary brand | Purple / lavender (`~#7B5EA7` range) | Window title bar, section headers, menu highlights |
| Active menu highlight | Blue-purple gradient | Selected menu item background |
| Status indicator (online) | Orange / amber dot | Contact presence indicator |
| Background | Light gray / near-white | Main panel, contact list area |
| Text | Dark gray / near-black | Labels, menu items |
| Accent borders | Medium gray | Panel separators, input borders |
| Window chrome | Windows XP system colors | Title bar uses OS-native purple gradient |

---

## Typography

- **Font**: System default — MS Sans Serif or Tahoma at 8-9pt (Windows XP standard)
- **Weight**: Regular throughout; no bold hierarchy in menus
- **Size**: Uniformly small — approximately 11-12px equivalent
- **Keyboard shortcuts**: Right-aligned in menus, lighter gray, monospace style (`Ctrl+M`, `Ctrl+L`)
- **No custom typefaces** — everything defers to the OS font stack

---

## Layout & Structure

### Window
- Fixed-width narrow panel (~220px wide)
- Standard Windows XP chrome: title bar with minimize/maximize/close buttons
- Menu bar directly below title bar: **Messenger | Contacts | Actions | Help**

### Sections (top to bottom)
1. **Profile strip** — avatar thumbnail + status text input ("share a status...")
2. **Search bar** — "type some contact i..." filter input, full width with icon button
3. **Contacts list** — collapsible group header ("Contacts (1/1)"), indented contact rows with presence dots

### Depth
- No cards or elevation shadows
- Panels are flat, separated by 1px borders or subtle color shifts
- Context menus appear as native Windows popups with drop shadow

---

## Iconography

- Small 16x16 icons throughout
- Status dot: filled circle, color-coded (orange = online)
- Avatar: square thumbnail with gray placeholder silhouette
- Menu chevrons (`▶`) for submenus, right-aligned
- Collapse triangle (`▼`) for contact group headers

---

## Controls

### Input fields
- Standard Windows text box, 1px inset border
- Placeholder text in gray ("type some contact i...")
- Inline icon button on right edge of search field

### Menus
- Native Windows context menu style
- Item height: ~18px
- Hover state: solid blue-purple background fill, white text
- Separator: 1px horizontal rule between menu sections
- Submenus trigger on hover with `▶` arrow indicator
- Keyboard shortcuts displayed right-aligned in the same row

### Buttons
- Minimal — "Add a C..." and "Plug..." visible as small labeled buttons at bottom
- Standard Windows push button style

---

## Interaction Patterns

- **Right-click / hover reveals nested context menus** — two levels deep (contact menu > More Actions submenu)
- **Keyboard-first** — nearly every action has a `Ctrl+` shortcut shown inline
- **Expandable groups** — contact groups collapse/expand with triangle toggle
- **Status presence** — always-visible colored dot per contact, no text label needed

---

## Overall Design Character

- **OS-native**: Fully integrated with Windows XP visual style. No custom chrome, no rounded corners beyond what the OS provides.
- **Compact density**: Maximum information in minimum space. No padding generosity.
- **Utility over aesthetics**: Purple branding is the only non-functional design choice. Everything else serves function.
- **Discoverability via menus**: Features are buried in nested menus rather than surfaced as icons or buttons.
- **No whitespace philosophy**: Elements stack tightly. Breathing room is not a value.
