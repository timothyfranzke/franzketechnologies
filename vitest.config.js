import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  // React components use the automatic JSX runtime (Astro's default).
  esbuild: { jsx: 'automatic' },
  test: {
    // .claude/worktrees holds full repo copies — don't double-run their tests.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
