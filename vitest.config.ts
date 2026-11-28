import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Tests run in a zone east of UTC so date-only handling (KAN-42 deadlines) is exercised the way
// most users see it. Set here, in the main process, so every worker inherits it; vi.stubEnv('TZ')
// inside a worker thread does not change the zone on Linux.
process.env.TZ = 'Europe/Kyiv';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'test/',
        '*.config.*',
        'dist/',
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/**/*.generated.ts',
      ],
      // Backlog index (T-40 / KAN-51): >= 70 % lines for the whole repository; raised to 75 % by
      // KAN-66 (measured 83 %). The boards and cards features have their own bar, checked by
      // scripts/check-module-coverage.mjs: a glob threshold here would remove those files from
      // this global figure (Vitest 1.x), which then fails at 70 %.
      thresholds: { lines: 75 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@api': path.resolve(__dirname, './src/api'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
});
