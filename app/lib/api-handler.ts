import { NextRequest, NextResponse } from 'next/server';

export function handleAsync<T extends unknown[]>(
  fn: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await fn(request, ...args);
    } catch (error) {
      console.error(`[${request.method}] ${request.nextUrl.pathname} error:`, error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
