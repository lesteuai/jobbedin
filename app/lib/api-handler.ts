import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/lib/auth';

export class BadRequestException extends Error {
  constructor(message: string = 'Bad request') {
    super(message);
    this.name = 'BadRequestException';
  }
}

export class UnauthorizedException extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedException';
  }
}

export class NotFoundException extends Error {
  constructor(message: string = 'Not found') {
    super(message);
    this.name = 'NotFoundException';
  }
}

export async function getSessionOrThrow(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    throw new UnauthorizedException();
  }
  return session;
}

function withErrorHandling<T extends unknown[]>(
  fn: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      return await fn(request, ...args);
    } catch (error) {
      if (error instanceof BadRequestException) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof UnauthorizedException) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      if (error instanceof NotFoundException) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      console.error(`[${request.method}] ${request.nextUrl.pathname} error:`, error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

export function handleAsync<T extends unknown[]>(
  fn: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return withErrorHandling(fn);
}

export function handleAsyncAuth<T extends unknown[]>(
  fn: (request: NextRequest, session: Awaited<ReturnType<typeof getSessionOrThrow>>, ...args: T) => Promise<NextResponse>
) {
  return withErrorHandling(async (request: NextRequest, ...args: T) => {
    const session = await getSessionOrThrow(request);
    return await fn(request, session, ...args);
  });
}

function withErrorHandlingStream<T extends unknown[]>(
  fn: (request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      return await fn(request, ...args);
    } catch (error) {
      if (error instanceof BadRequestException) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (error instanceof UnauthorizedException) {
        return new Response(JSON.stringify({ error: error.message }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      if (error instanceof NotFoundException) {
        return new Response(JSON.stringify({ error: error.message }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      console.error(`[${request.method}] ${request.nextUrl.pathname} error:`, error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  };
}

export function handleAsyncAuthStream<T extends unknown[]>(
  fn: (request: NextRequest, session: Awaited<ReturnType<typeof getSessionOrThrow>>, ...args: T) => Promise<Response>
) {
  return withErrorHandlingStream(async (request: NextRequest, ...args: T) => {
    const session = await getSessionOrThrow(request);
    return await fn(request, session, ...args);
  });
}
