# Build & Configuration

## Purpose

Document the build toolchain, dependency management, TypeScript configuration, and runtime setup. The project uses Vite for development and bundling, TanStack Router for client-side routing, Tailwind CSS v4 for styling, and targets Cloudflare Workers for deployment.

## Location

- `vite.config.ts` — Vite build configuration
- `tsconfig.json` — TypeScript compiler options
- `package.json` — NPM dependencies and scripts
- `eslint.config.js` — ESLint configuration (flat config format)
- `.prettierrc` — Prettier code formatting config
- `components.json` — Shadcn/ui component library config (unused)

## Entry Points

**Build Flow**

1. `src/main.tsx` — React root entry point
2. `src/start.ts` — Vite SSR entry point (Cloudflare Workers context)
3. `src/server.ts` — Fetch handler for Cloudflare Workers

**Development**

- `npm run dev` → Vite dev server (hot module reloading)

**Production**

- `npm run build` → Vite build with SSR support (outputs dist/)
- `npm run build:dev` → Build in development mode (for debugging)
- `npm run preview` → Local preview of production build

## Architecture / Key Components

**Vite Configuration**

```typescript
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
});
```

**Plugins:**
- `tanstackRouter`: Auto-generates route tree from file structure; enables code splitting per route
- `react()`: JSX transformation and Fast Refresh (hot reloading)
- `tailwindcss()`: Tailwind v4 support (scans source for class names)
- `tsconfigPaths()`: Resolves `@/*` alias defined in tsconfig

**TypeScript Configuration**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "react-jsx",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Key Settings:**
- `target: ES2022` — Output modern JS (no IE11 support)
- `jsx: react-jsx` — New JSX transform (no React import needed in files)
- `moduleResolution: Bundler` — Resolves like Vite/esbuild
- `strict: true` — Full strict mode enabled
- `@/*` alias — Import from src/ with `@/lib/app-store` instead of `../lib/app-store`

**Package.json Scripts**

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

**NPM vs pnpm**

Project appears to use pnpm (inferred from node_modules/.pnpm structure). Run:
```bash
pnpm install
pnpm run dev
```

Or npm if preferred:
```bash
npm install
npm run dev
```

**ESLint Configuration**

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "typescript-eslint": tseslint.plugin,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
```

Flat config format (ESLint v9+). Enables React Hooks linting.

**Prettier Configuration**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- Semicolons enabled
- Double quotes
- Trailing commas in ES5 objects/arrays
- 100-character line width

**Shadcn/ui Configuration** (components.json)

```json
{
  "style": "default",
  "tsx": true,
  "baseColor": "slate"
}
```

Unused in current design (project uses custom .ym-* components, not shadcn/ui). Config exists from project initialization but can be ignored.

## Dependencies & Integrations

**Core Runtime**

- `react` 19.2.0 — React library
- `react-dom` 19.2.0 — DOM rendering
- `@tanstack/react-router` 1.168.25 — File-based routing
- `@tanstack/react-start` 1.167.50 — Full-stack framework (includes SSR support)
- `@tanstack/react-query` 5.83.0 — Server state management (minimal use in current mock)

**Styling**

- `tailwindcss` 4.2.1 — Utility CSS framework (v4, new architecture)
- `@tailwindcss/vite` 4.2.1 — Tailwind v4 Vite plugin
- `clsx` 2.1.1 — Conditional className utility
- `tailwind-merge` 3.5.0 — Merge conflicting Tailwind classes
- `tw-animate-css` 1.3.4 — Pre-built animation classes

**UI & Components**

- `@radix-ui/*` (30+ packages) — Headless component primitives
  - All installed; none imported in current design
  - Future use expected for accessible form elements, popovers, etc.
- `lucide-react` 0.575.0 — Icon library (unused; emojis used instead)
- `recharts` 2.15.4 — Chart library (unused; future use for reports)
- `react-markdown` 10.1.0 — Markdown renderer (used in analysis panels)
- `sonner` 2.0.7 — Toast notification library (installed, unused)
- `cmdk` 1.1.1 — Command palette component (installed, unused)
- `embla-carousel-react` 8.6.0 — Carousel component (unused)
- `vaul` 1.1.2 — Drawer/sheet primitives (unused)
- `input-otp` 1.4.2 — OTP input component (unused)
- `react-day-picker` 9.14.0 — Date picker (unused)
- `react-resizable-panels` 4.6.5 — Resizable panels (unused)
- `class-variance-authority` 0.7.1 — Component variant system (used by shadcn/ui components, unused here)

**Forms & Validation**

- `react-hook-form` 7.71.2 — Form state (installed, not used)
- `zod` 3.24.2 — Schema validation (installed, not used)
- `@hookform/resolvers` 5.2.2 — Form validation adapters (installed, not used)

**Build & Development**

- `vite` 7.3.1 — Build tool and dev server
- `@vitejs/plugin-react` 5.2.0 — React JSX support in Vite
- `@cloudflare/vite-plugin` 1.37.1 — Cloudflare Workers integration
- `@tanstack/router-plugin` 1.167.28 — Vite plugin for TanStack Router
- `vite-tsconfig-paths` 6.0.2 — Path alias resolution

**TypeScript**

- `typescript` 5.8.3 — Type checker
- `@types/node` 22.19.19 — Node.js type definitions
- `@types/react` 19.2.14 — React types
- `@types/react-dom` 19.2.3 — React DOM types

**Linting & Formatting**

- `eslint` 9.39.4 — Linter
- `@eslint/js` 9.39.4 — ESLint recommended rules
- `typescript-eslint` 8.59.3 — TypeScript support for ESLint
- `eslint-plugin-react-hooks` 5.2.0 — React Hooks linting
- `eslint-plugin-react-refresh` 0.4.26 — React Fast Refresh linting
- `eslint-config-prettier` 10.1.8 — Prettier integration for ESLint
- `eslint-plugin-prettier` 5.5.5 — Prettier plugin for ESLint
- `prettier` 3.8.3 — Code formatter
- `globals` 15.15.0 — Global variable definitions

**Utilities**

- `date-fns` 4.1.0 — Date manipulation (unused)

## Build Process

**Development**

```bash
npm run dev
```

- Starts Vite dev server (usually http://localhost:5173)
- Watches src/ files
- Hot module reloading on save
- No bundling; serves modules as-is

**Production**

```bash
npm run build
```

1. TypeScript type-checks entire codebase
2. Tailwind scans src/ for class names, generates optimized CSS
3. Vite bundles and code-splits by route
4. SSR entrypoint (src/start.ts) bundled for Cloudflare Workers
5. Output to dist/ directory

**Build output structure:**
```
dist/
├── _worker.js          Cloudflare Worker entry
├── client/             Client-side bundles (per route)
│   ├── entry.*.js
│   ├── app.*.js
│   └── index.*.js
└── ...                 Other compiled artifacts
```

**Cloudflare Workers Deployment**

The `src/server.ts` export is the fetch handler. When deployed to Cloudflare Workers:
- Incoming HTTP request passed to `fetch()` function
- Handler normalizes catastrophic SSR errors and returns branded error page
- Delegates actual routing to TanStack React Start server entry

## Patterns & Conventions

**Import/Export**

- ESM only (no CommonJS)
- Default exports for route components
- Named exports for utilities, types, components
- `@/` alias for all src/ imports (avoids relative paths)

**Path resolution**

- `@/components/*` → src/components/*
- `@/lib/*` → src/lib/*
- `@/routes/*` → src/routes/*
- `@/hooks/*` → src/hooks/*

**Environment variables**

- `.env` and `.env.*` files in .gitignore
- No .env.example provided (none needed for mock frontend)
- Future: add .env.example for API_KEY, API_BASE_URL, etc.

**Output artifacts**

- Development: src/ compiled on-the-fly by Vite
- Production: dist/ contains optimized, minified bundles
- .next and .output directories mentioned in .gitignore but not used (legacy references from template)

## Gotchas & Non-Obvious Logic

- **Flat ESLint config**. Uses new flat config format (ESLint v9+); older plugins may not support it. If adding new plugins, check compatibility.
- **Tailwind v4 architectural change**. Tailwind v4 no longer requires a tailwind.config.js file; it's auto-generated. Custom theme colors must be defined via CSS variables (as done in styles.css).
- **TypeScript noEmit: true**. TypeScript is configured with `noEmit: true`, meaning it only type-checks; Vite handles compilation. Running `tsc` directly will fail.
- **React 19 experimental**. React 19 is recent; some libraries may not fully support it yet. Pinned to specific versions.
- **@tanstack/react-start is full-stack**. Unlike standard React, TanStack Start includes SSR and server routing capabilities. The src/server.ts file is part of this.
- **Route tree auto-generated**. `src/routeTree.gen.ts` should never be edited manually; it's regenerated by the Vite plugin on dev/build. If routes don't show up, delete this file and restart dev server.
- **Cloudflare Workers context**. The app can run in a browser, a Node.js server, or Cloudflare Workers. Code must avoid Node-specific APIs (e.g., fs, child_process). All current code is portable.

## Open Questions

- Should build output be committed to version control (dist/) or generated on CI?
- Should there be a separate docker-compose.yml for local development (backend services)?
- Should environment variables be documented in a .env.example file?
- Should there be pre-commit hooks (husky) to lint/format before committing?
- Should bundle size be monitored (e.g., via bundlesize or size-limit package)?
