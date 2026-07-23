import { describe, it, expect, vi } from 'vitest';
import { resolveStatusReason, isGibberish } from '@/app/lib/workflow';
import { STATUS_REASON } from '@/app/lib/constants';

vi.mock('@/app/lib/db', () => ({ db: {} }));
vi.mock('@langchain/tavily', () => ({
  TavilySearch: class TavilySearch {
    invoke() {
      return Promise.resolve('');
    }
  },
}));
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class ChatOpenAI {},
}));

describe('isGibberish', () => {
  it('returns true for an empty string', () => {
    expect(isGibberish('')).toBe(true);
  });

  it('returns true for a whitespace-only string', () => {
    expect(isGibberish('   \n\t  ')).toBe(true);
  });

  it('returns false for normal English prose', () => {
    expect(
      isGibberish(
        'I am excited to apply for this role. My experience aligns well with the requirements.'
      )
    ).toBe(false);
  });

  it('returns false for realistic markdown output', () => {
    const markdown = `## Resume Feedback

**Strengths:** Strong technical background with clear ownership of projects.

- Quantify impact with metrics where possible
- Tailor summary to the target role
- Highlight leadership experience

| Skill | Match |
| --- | --- |
| TypeScript | Strong |
| Leadership | Moderate |
`;
    expect(isGibberish(markdown)).toBe(false);
  });

  it('returns true when replacement/control characters exceed 5% of length', () => {
    // 1 bad char in 10 characters = 10%
    const text = '\x00123456789';
    expect(isGibberish(text)).toBe(true);
  });

  it('returns false when replacement/control characters stay under 5% of length', () => {
    // 1 bad char in 200 characters = 0.5%. Padding is varied prose (not a
    // single repeated character) so it does not also trip the repeat regexes.
    let padding = '';
    while (padding.length < 199) {
      padding +=
        'The quick brown fox jumps over the lazy dog wandering near hills today morning walking calmly across fields ';
    }
    const text = '\x00' + padding.slice(0, 199);
    expect(isGibberish(text)).toBe(false);
  });

  it('returns true when one character repeats 40 or more times', () => {
    expect(isGibberish('a'.repeat(40))).toBe(true);
  });

  it('returns false when one character repeats 31 times embedded in normal text', () => {
    // A uniform run of the same character also matches the 2-4 char repeat
    // regex once it reaches 32 characters, so 31 is the real safe boundary
    // for isolating the single-character-repeat regex.
    const text = `Here is a normal sentence with ${'a'.repeat(
      31
    )} in the middle of it, followed by more normal words.`;
    expect(isGibberish(text)).toBe(false);
  });

  it('returns true when a 2-4 char sequence repeats 16 or more times', () => {
    expect(isGibberish('ab'.repeat(16))).toBe(true);
  });

  it('returns false when a 2-4 char sequence repeats exactly 15 times', () => {
    const text = `Normal text before ${'ab'.repeat(
      15
    )} and normal text after it to keep things realistic.`;
    expect(isGibberish(text)).toBe(false);
  });

  it('trims leading and trailing whitespace before checks', () => {
    expect(isGibberish('   This is a normal sentence.   ')).toBe(false);
  });
});

describe('resolveStatusReason', () => {
  class APIError extends Error {
    status?: number;
    code?: string | number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = 'APIError';
      this.status = status;
    }
  }

  class AuthenticationError extends Error {
    status?: number;
    code?: string | number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = 'AuthenticationError';
      this.status = status;
    }
  }

  it('returns OUT_OF_CREDIT for a 402 APIError', () => {
    const error = new APIError('out of credit', 402);
    expect(resolveStatusReason(error)).toBe(STATUS_REASON.OUT_OF_CREDIT);
  });

  it('returns INVALID_API_KEY for a 401 AuthenticationError', () => {
    const error = new AuthenticationError('invalid key', 401);
    expect(resolveStatusReason(error)).toBe(STATUS_REASON.INVALID_API_KEY);
  });

  it('returns null for a plain Error', () => {
    expect(resolveStatusReason(new Error('boom'))).toBeNull();
  });

  it('returns null for null', () => {
    expect(resolveStatusReason(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(resolveStatusReason(undefined)).toBeNull();
  });

  it('returns null for a string', () => {
    expect(resolveStatusReason('some error')).toBeNull();
  });

  it('returns null for an APIError with an unrelated status', () => {
    const error = new APIError('server error', 500);
    expect(resolveStatusReason(error)).toBeNull();
  });
});
