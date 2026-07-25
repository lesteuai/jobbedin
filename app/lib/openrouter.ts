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
    maxTokens: 4096,
    modelKwargs: { frequency_penalty: 0.3 },
    apiKey: resolveApiKey(encryptedApiKey),
    configuration: { baseURL: 'https://openrouter.ai/api/v1' },
  });
}

export function createWritingLlm(encryptedApiKey?: string | null): ChatOpenAI {
  return new ChatOpenAI({
    modelName: process.env.WRITING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct',
    temperature: 0.7,
    maxTokens: 4096,
    modelKwargs: { frequency_penalty: 0.3 },
    apiKey: resolveApiKey(encryptedApiKey),
    configuration: { baseURL: 'https://openrouter.ai/api/v1' },
  });
}

function defineErrorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const e = error as { status?: number; code?: number | string };
  const errorCode = e.status ?? Number(e.code);
  return errorCode;
}

export const isOutOfCreditError = (e: unknown) => defineErrorCode(e) === 402;
export const isAuthError = (e: unknown) => defineErrorCode(e) === 401;
