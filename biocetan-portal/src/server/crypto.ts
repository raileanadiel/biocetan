/**
 * Cryptographic primitives, WebCrypto only (runs in workerd and in the tests).
 * Everything security-sensitive in the portal goes through these helpers; don't hand-roll
 * hashing or comparisons elsewhere.
 */

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** URL-safe random token, 256 bits by default (session cookies, invitation/reset links). */
export function randomToken(bytes = 32): string {
  return toBase64Url(randomBytes(bytes));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two strings in time that depends only on their length, not on where they differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

// --- passwords -----------------------------------------------------------------------------

/**
 * PBKDF2-SHA256. 100 000 iterations is the maximum Cloudflare Workers allows (higher throws
 * NotSupportedError); it costs ~tens of ms of CPU, which needs the Workers Paid plan in
 * production (the free plan caps a request at 10 ms CPU).
 */
export const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationsText, saltText, hashText] = stored.split('$');
  const iterations = Number(iterationsText);
  if (scheme !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || !saltText || !hashText) {
    return false;
  }
  const hash = await pbkdf2(password, fromBase64Url(saltText), iterations);
  return constantTimeEqual(toBase64Url(hash), hashText);
}

/** Whether a hash was made with weaker settings than today's and should be re-hashed on login. */
export function passwordNeedsRehash(stored: string): boolean {
  const [scheme, iterations] = stored.split('$');
  return scheme !== 'pbkdf2-sha256' || Number(iterations) < PBKDF2_ITERATIONS;
}

// A valid hash of a random password. Unknown emails are checked against it so a login attempt
// takes the same time whether or not the account exists (no account enumeration by timing).
let dummyHash: Promise<string> | undefined;
export function getDummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomToken());
  return dummyHash;
}

// --- symmetric encryption (TOTP secrets) ---------------------------------------------------

async function importAesKey(keyBase64Url: string): Promise<CryptoKey> {
  const raw = fromBase64Url(keyBase64Url);
  if (raw.length !== 32) throw new Error('Encryption key must be 32 bytes (base64url)');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** AES-256-GCM. Output: `v1.<iv>.<ciphertext>`, both base64url. */
export async function encryptString(plaintext: string, keyBase64Url: string): Promise<string> {
  const iv = randomBytes(12);
  const key = await importAesKey(keyBase64Url);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptString(payload: string, keyBase64Url: string): Promise<string> {
  const [version, ivText, dataText] = payload.split('.');
  if (version !== 'v1' || !ivText || !dataText) throw new Error('Unknown ciphertext format');
  const key = await importAesKey(keyBase64Url);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivText) },
    key,
    fromBase64Url(dataText),
  );
  return new TextDecoder().decode(plaintext);
}
