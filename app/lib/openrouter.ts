import { ChatOpenAI } from '@langchain/openai';
import { decrypt } from '@/app/lib/crypto';

function resolveApiKey(encryptedApiKey?: string | null): string | undefined {
  if (encryptedApiKey && encryptedApiKey.trim().length > 0) {
    try {
      const decrypted = decrypt(encryptedApiKey);
      if (decrypted && decrypted.trim().length > 0) return decrypted.trim();
    } catch (error) {
      console.error('Failed to decrypt user OpenRouter API key:', error);
    }
  }
  return process.env.OPENROUTER_API_KEY;
}

export function createReasoningLlm(encryptedApiKey?: string | null): ChatOpenAI {
  return new ChatOpenAI({
    modelName: process.env.REASONING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct',
    temperature: 0,
    maxTokens: 2048,
    modelKwargs: { frequency_penalty: 0.3 },
    apiKey: resolveApiKey(encryptedApiKey),
    configuration: { baseURL: 'https://openrouter.ai/api/v1' },
  });
}

export function createWritingLlm(encryptedApiKey?: string | null): ChatOpenAI {
  return new ChatOpenAI({
    modelName: process.env.WRITING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct',
    temperature: 0.7,
    maxTokens: 2048,
    modelKwargs: { frequency_penalty: 0.3 },
    apiKey: resolveApiKey(encryptedApiKey),
    configuration: { baseURL: 'https://openrouter.ai/api/v1' },
  });
}

interface ApiErrorShape {
  constructor?: { name?: string };
  status?: number;
  code?: number | string;
}

function isApiErrorShape(error: unknown): error is ApiErrorShape {
  return typeof error === 'object' && error !== null;
}

export function isOutOfCreditError(error: unknown): boolean {
  if (!isApiErrorShape(error)) return false;
  if (error.constructor?.name !== 'APIError') return false;
  return error.status === 402 || Number(error.code) === 402;
}

export function isAuthError(error: unknown): boolean {
  if (!isApiErrorShape(error)) return false;
  if (error.constructor?.name !== 'AuthenticationError') return false;
  return error.status === 401 || Number(error.code) === 401;
}
