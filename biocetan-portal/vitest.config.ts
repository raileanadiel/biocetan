import { defineConfig } from 'vitest/config';

// Tests call the server modules in src/server directly, against a real SQLite file with the real
// migrations (test/setup.ts), so SQL, triggers and WebCrypto behave as in production.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    // PBKDF2 at 600k iterations makes the auth flows slow-ish; give them room.
    testTimeout: 30_000,
  },
});
