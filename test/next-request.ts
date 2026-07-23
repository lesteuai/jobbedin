import { NextRequest } from 'next/server';

export function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

export function makeJsonRequest(url: string, body: unknown, init?: RequestInit): NextRequest {
  const method = init?.method ?? 'POST';
  return new NextRequest(url, {
    ...init,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    body: JSON.stringify(body),
  });
}
