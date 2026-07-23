import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encrypt } from '@/app/lib/crypto';

vi.mock('@langchain/openai', () => {
  class ChatOpenAI {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
  }
  return { ChatOpenAI };
});

import {
  createReasoningLlm,
  createWritingLlm,
  isOutOfCreditError,
  isAuthError,
} from '@/app/lib/openrouter';

type CapturedConfig = {
  modelName: string;
  temperature: number;
  maxTokens: number;
  modelKwargs: Record<string, unknown>;
  apiKey?: string;
  configuration: { baseURL: string };
};

// The ChatOpenAI mock above stores its constructor argument, so the factories'
// return value is inspected through that captured config rather than the real class.
function capturedConfig(llm: unknown): CapturedConfig {
  return (llm as { config: CapturedConfig }).config;
}

describe('createReasoningLlm', () => {
  it('passes fixed temperature, maxTokens, modelKwargs, and baseURL', () => {
    const config = capturedConfig(createReasoningLlm());
    expect(config.temperature).toBe(0);
    expect(config.maxTokens).toBe(4096);
    expect(config.modelKwargs).toEqual({ frequency_penalty: 0.3 });
    expect(config.configuration.baseURL).toBe('https://openrouter.ai/api/v1');
  });

  it('uses process.env.REASONING_MODEL when set', () => {
    const original = process.env.REASONING_MODEL;
    process.env.REASONING_MODEL = 'custom/reasoning-model';
    const config = capturedConfig(createReasoningLlm());
    expect(config.modelName).toBe('custom/reasoning-model');
    process.env.REASONING_MODEL = original;
  });

  it('falls back to default model when REASONING_MODEL is unset', () => {
    const original = process.env.REASONING_MODEL;
    delete process.env.REASONING_MODEL;
    const config = capturedConfig(createReasoningLlm());
    expect(config.modelName).toBe('meta-llama/llama-3.1-8b-instruct');
    process.env.REASONING_MODEL = original;
  });
});

describe('createWritingLlm', () => {
  it('passes temperature 0.7 and the same maxTokens/modelKwargs/baseURL', () => {
    const config = capturedConfig(createWritingLlm());
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(4096);
    expect(config.modelKwargs).toEqual({ frequency_penalty: 0.3 });
    expect(config.configuration.baseURL).toBe('https://openrouter.ai/api/v1');
  });

  it('uses process.env.WRITING_MODEL when set', () => {
    const original = process.env.WRITING_MODEL;
    process.env.WRITING_MODEL = 'custom/writing-model';
    const config = capturedConfig(createWritingLlm());
    expect(config.modelName).toBe('custom/writing-model');
    process.env.WRITING_MODEL = original;
  });

  it('falls back to default model when WRITING_MODEL is unset', () => {
    const original = process.env.WRITING_MODEL;
    delete process.env.WRITING_MODEL;
    const config = capturedConfig(createWritingLlm());
    expect(config.modelName).toBe('meta-llama/llama-3.1-8b-instruct');
    process.env.WRITING_MODEL = original;
  });
});

describe('key resolution via createReasoningLlm', () => {
  const originalServerKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'server-fallback-key';
  });

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalServerKey;
    vi.restoreAllMocks();
  });

  it('decrypts a valid encrypted key and passes it as apiKey', () => {
    const encrypted = encrypt('user-real-key');
    const config = capturedConfig(createReasoningLlm(encrypted));
    expect(config.apiKey).toBe('user-real-key');
  });

  it('falls back to server key when encryptedApiKey is undefined', () => {
    const config = capturedConfig(createReasoningLlm(undefined));
    expect(config.apiKey).toBe('server-fallback-key');
  });

  it('falls back to server key when encryptedApiKey is null', () => {
    const config = capturedConfig(createReasoningLlm(null));
    expect(config.apiKey).toBe('server-fallback-key');
  });

  it('falls back to server key when encryptedApiKey is an empty string', () => {
    const config = capturedConfig(createReasoningLlm(''));
    expect(config.apiKey).toBe('server-fallback-key');
  });

  it('falls back to server key when encryptedApiKey is whitespace only', () => {
    const config = capturedConfig(createReasoningLlm('   '));
    expect(config.apiKey).toBe('server-fallback-key');
  });

  it('logs and falls back to server key when the key is undecryptable', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const config = capturedConfig(createReasoningLlm('not-a-valid-payload'));
    expect(config.apiKey).toBe('server-fallback-key');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('falls back to server key when the decrypted key is whitespace only', () => {
    const encrypted = encrypt('   ');
    const config = capturedConfig(createReasoningLlm(encrypted));
    expect(config.apiKey).toBe('server-fallback-key');
  });

  it('trims the resolved key', () => {
    const encrypted = encrypt('  padded-key  ');
    const config = capturedConfig(createReasoningLlm(encrypted));
    expect(config.apiKey).toBe('padded-key');
  });
});

class APIError extends Error {
  status?: number;
  code?: number | string;
  constructor(props: { status?: number; code?: number | string }) {
    super('api error');
    this.status = props.status;
    this.code = props.code;
  }
}

class AuthenticationError extends Error {
  status?: number;
  code?: number | string;
  constructor(props: { status?: number; code?: number | string }) {
    super('auth error');
    this.status = props.status;
    this.code = props.code;
  }
}

class OtherError extends Error {
  status?: number;
  constructor(props: { status?: number }) {
    super('other error');
    this.status = props.status;
  }
}

describe('isOutOfCreditError', () => {
  it('is true for APIError with status 402', () => {
    expect(isOutOfCreditError(new APIError({ status: 402 }))).toBe(true);
  });

  it('is true for APIError with numeric code 402', () => {
    expect(isOutOfCreditError(new APIError({ code: 402 }))).toBe(true);
  });

  it('is true for APIError with string code "402"', () => {
    expect(isOutOfCreditError(new APIError({ code: '402' }))).toBe(true);
  });

  it('is false for APIError with status 500', () => {
    expect(isOutOfCreditError(new APIError({ status: 500 }))).toBe(false);
  });

  it('is false for a different class name with status 402', () => {
    expect(isOutOfCreditError(new OtherError({ status: 402 }))).toBe(false);
  });

  it('is false for null, undefined, string, and number', () => {
    expect(isOutOfCreditError(null)).toBe(false);
    expect(isOutOfCreditError(undefined)).toBe(false);
    expect(isOutOfCreditError('402')).toBe(false);
    expect(isOutOfCreditError(402)).toBe(false);
  });

  it('is false for an AuthenticationError with status 401', () => {
    expect(isOutOfCreditError(new AuthenticationError({ status: 401 }))).toBe(false);
  });
});

describe('isAuthError', () => {
  it('is true for AuthenticationError with status 401', () => {
    expect(isAuthError(new AuthenticationError({ status: 401 }))).toBe(true);
  });

  it('is true for AuthenticationError with numeric code 401', () => {
    expect(isAuthError(new AuthenticationError({ code: 401 }))).toBe(true);
  });

  it('is true for AuthenticationError with string code "401"', () => {
    expect(isAuthError(new AuthenticationError({ code: '401' }))).toBe(true);
  });

  it('is false for AuthenticationError with status 500', () => {
    expect(isAuthError(new AuthenticationError({ status: 500 }))).toBe(false);
  });

  it('is false for a different class name with status 401', () => {
    expect(isAuthError(new OtherError({ status: 401 }))).toBe(false);
  });

  it('is false for null, undefined, string, and number', () => {
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
    expect(isAuthError('401')).toBe(false);
    expect(isAuthError(401)).toBe(false);
  });

  it('is false for an APIError with status 402', () => {
    expect(isAuthError(new APIError({ status: 402 }))).toBe(false);
  });
});
