import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    globals: true,
    passWithNoTests: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/lib/**', 'app/api/**'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['app/**/*.test.ts', 'test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'dom',
          include: ['app/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts', './vitest.setup.dom.ts'],
        },
      },
    ],
  },
});
