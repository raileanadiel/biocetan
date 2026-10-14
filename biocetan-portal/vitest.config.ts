import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Tests run inside workerd (the real Workers runtime) with a local D1 holding the real
// migrations, so SQL, triggers and WebCrypto behave exactly as in production. The Astro
// entrypoint isn't loaded: tests call the server modules in src/server directly.
export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: '2026-10-01',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: ['DB'],
          bindings: {
            TEST_MIGRATIONS: migrations,
            PORTAL_URL: 'https://portal.test',
            MAIL_FROM: 'BIOCETAN Portal <no-reply@biocetan.ro>',
            RESEND_API_URL: 'https://resend.test',
            RESEND_API_KEY: 're_test',
            // Test-only key: "test-key-test-key-test-key-32byt" (32 bytes, base64url).
            TOTP_ENC_KEY: 'dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMzJieXQ',
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/setup.ts'],
      include: ['test/**/*.test.ts'],
    },
  };
});
