import { defineConfig } from 'vitest/config';

// Minimal config for unit-testing plain TS modules without loading Svelte/Vite plugins.
export default defineConfig({
  plugins: [],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
    watch: false,
  },
});
