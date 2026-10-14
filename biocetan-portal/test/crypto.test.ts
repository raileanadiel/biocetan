import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  decryptString,
  encryptString,
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from '../src/server/crypto';
import { base32Decode, base32Encode, totpAt, verifyTotp } from '../src/server/auth/totp';
import { passwordProblem } from '../src/server/validation';

const KEY = 'dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktMzJieXQ';

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('a long passphrase here');
    expect(hash.startsWith('pbkdf2-sha256$100000$')).toBe(true);
    expect(await verifyPassword('a long passphrase here', hash)).toBe(true);
    expect(await verifyPassword('a long passphrase herE', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same password twice')).not.toBe(
      await hashPassword('same password twice'),
    );
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    expect(await verifyPassword('x', 'plaintext')).toBe(false);
    expect(await verifyPassword('x', 'md5$1$a$b')).toBe(false);
  });

  it('flags weaker hashes for re-hashing', async () => {
    expect(passwordNeedsRehash('pbkdf2-sha256$10000$a$b')).toBe(true);
    expect(passwordNeedsRehash(await hashPassword('fresh password ok'))).toBe(false);
  });

  it('applies the password policy', () => {
    expect(passwordProblem('short', 'a@b.ro')).toBe('passwordTooShort');
    expect(passwordProblem('x'.repeat(129), 'a@b.ro')).toBe('passwordTooLong');
    expect(passwordProblem('password1234', 'a@b.ro')).toBe('passwordCommon');
    expect(passwordProblem('aaaaaaaaaaaaaaaa', 'a@b.ro')).toBe('passwordCommon');
    expect(passwordProblem('maria.popescu-2026!', 'maria.popescu@agro.ro')).toBe(
      'passwordContainsEmail',
    );
    expect(passwordProblem('correct horse battery staple', 'maria@agro.ro')).toBeNull();
  });
});

describe('constantTimeEqual', () => {
  it('compares by value', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });
});

describe('AES-GCM', () => {
  it('round-trips and uses a fresh IV each time', async () => {
    const a = await encryptString('JBSWY3DPEHPK3PXP', KEY);
    const b = await encryptString('JBSWY3DPEHPK3PXP', KEY);
    expect(a).not.toBe(b);
    expect(await decryptString(a, KEY)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('detects tampering', async () => {
    const payload = await encryptString('secret', KEY);
    const [v, iv, data] = payload.split('.');
    const flipped = data!.slice(0, -2) + (data!.endsWith('AA') ? 'BB' : 'AA');
    await expect(decryptString(`${v}.${iv}.${flipped}`, KEY)).rejects.toThrow();
  });

  it('rejects a key of the wrong size', async () => {
    await expect(encryptString('x', 'c2hvcnQ')).rejects.toThrow(/32 bytes/);
  });
});

describe('TOTP (RFC 6238 test vectors, SHA-1)', () => {
  // RFC 6238 appendix B: secret "12345678901234567890" (ASCII), 8 digits. Our codes are the
  // last 6 digits of the same values.
  const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));

  it('base32 round-trips', () => {
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(new TextDecoder().decode(base32Decode(secret))).toBe('12345678901234567890');
  });

  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('time %i → %s', async (seconds, code) => {
    expect(await totpAt(secret, Math.floor(seconds / 30))).toBe(code);
  });

  it('accepts ±1 step and refuses replays', async () => {
    const now = 1_234_567_890_000;
    const step = Math.floor(now / 30_000);
    const previous = await totpAt(secret, step - 1);
    expect(await verifyTotp(secret, previous, null, now)).toBe(step - 1);
    expect(await verifyTotp(secret, previous, step - 1, now)).toBeNull();
    expect(await verifyTotp(secret, await totpAt(secret, step - 2), null, now)).toBeNull();
    expect(await verifyTotp(secret, '12345', null, now)).toBeNull();
    expect(await verifyTotp(secret, 'abcdef', null, now)).toBeNull();
  });
});
