import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/ui/**/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['tests/ui/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['client/src/policy/*.tsx', 'client/src/views/ImportForm.tsx'],
      thresholds: { lines: 70, functions: 65, branches: 60 },
    },
  },
});
