import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt } from '@/app/lib/crypto';

const HEX_SEGMENT_PATTERN = /^[0-9a-f]+$/;

describe('crypto', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.BETTER_AUTH_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = originalSecret;
    }
  });

  describe('round-trip', () => {
    it('returns the original plain ASCII string', () => {
      const plaintext = 'hello world, this is a plain ascii string';
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it('returns the original unicode string', () => {
      const plaintext = 'héllo wörld 🎉🔥 café naïve';
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it('returns the original empty string', () => {
      const plaintext = '';
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });
  });

  describe('payload shape', () => {
    it('produces exactly 3 colon-separated hex segments with the expected lengths', () => {
      const payload = encrypt('some plaintext');
      const parts = payload.split(':');

      expect(parts).toHaveLength(3);

      const [ivHex, authTagHex, ciphertextHex] = parts;
      expect(ivHex).toMatch(HEX_SEGMENT_PATTERN);
      expect(authTagHex).toMatch(HEX_SEGMENT_PATTERN);
      expect(ciphertextHex.length === 0 || HEX_SEGMENT_PATTERN.test(ciphertextHex)).toBe(true);

      expect(ivHex).toHaveLength(24); // 12 bytes
      expect(authTagHex).toHaveLength(32); // 16 bytes
    });
  });

  describe('random IV per call', () => {
    it('produces different ciphertext for the same plaintext, both decrypting back correctly', () => {
      const plaintext = 'repeated plaintext value';
      const first = encrypt(plaintext);
      const second = encrypt(plaintext);

      expect(first).not.toBe(second);
      expect(decrypt(first)).toBe(plaintext);
      expect(decrypt(second)).toBe(plaintext);
    });
  });

  describe('malformed payload', () => {
    it.each([['abc'], ['a:b'], ['a:b:c:d']])(
      'throws Malformed encrypted payload for %s',
      (payload) => {
        expect(() => decrypt(payload)).toThrow('Malformed encrypted payload');
      },
    );
  });

  describe('tampering', () => {
    // Flip the first character of a hex segment to an alternate valid hex char.
    function flipFirstHexChar(segment: string): string {
      const alternate = segment[0] === 'a' ? 'b' : 'a';
      return alternate + segment.slice(1);
    }

    it('throws when the auth tag is tampered with', () => {
      const [ivHex, authTagHex, ciphertextHex] = encrypt('sensitive data').split(':');
      const tampered = `${ivHex}:${flipFirstHexChar(authTagHex)}:${ciphertextHex}`;
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws when the ciphertext is tampered with', () => {
      const [ivHex, authTagHex, ciphertextHex] = encrypt('sensitive data').split(':');
      const tampered = `${ivHex}:${authTagHex}:${flipFirstHexChar(ciphertextHex)}`;
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('missing secret', () => {
    it('encrypt throws BETTER_AUTH_SECRET is not set when env var is absent', () => {
      delete process.env.BETTER_AUTH_SECRET;
      expect(() => encrypt('anything')).toThrow('BETTER_AUTH_SECRET is not set');
    });

    it('decrypt throws BETTER_AUTH_SECRET is not set when env var is absent', () => {
      delete process.env.BETTER_AUTH_SECRET;
      const payload = 'aaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:cc';
      expect(() => decrypt(payload)).toThrow('BETTER_AUTH_SECRET is not set');
    });
  });
});
