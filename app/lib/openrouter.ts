import { ChatOpenAI } from '@langchain/openai';

function resolveApiKey(apiKey?: string | null): string | undefined {
  if (apiKey && apiKey.trim().length > 0) return apiKey.trim();
  return process.env.OPENROUTER_API_KEY;
}

export function createReasoningLlm(apiKey?: string | null): ChatOpenAI {
  return new ChatOpenAI({
    modelName: process.env.REASONING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct',
    temperature: 0,
    apiKey: resolveApiKey(apiKey),
    configuration: { baseURL: 'https://openrouter.ai/api/v1' },
  });
}

export function createWritingLlm(apiKey?: string | null): ChatOpenAI {
  return new ChatOpenAI({
    modelName: process.env.WRITING_MODEL ?? 'meta-llama/llama-3.1-8b-instruct',
    temperature: 0.7,
    apiKey: resolveApiKey(apiKey),
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
