import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React components use the automatic JSX runtime (Astro's default).
  esbuild: { jsx: 'automatic' },
});
