import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  handleAsync,
  handleAsyncAuth,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@/app/lib/api-handler';

vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import { auth } from '@/app/lib/auth';

function makeRequest(method = 'GET', url = 'http://localhost/api/test') {
  return new NextRequest(url, { method });
}

describe('handleAsync', () => {
  it('passes through a successful response', async () => {
    const handler = handleAsync(async () => NextResponse.json({ ok: true }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 400 for BadRequestException', async () => {
    const handler = handleAsync(async () => {
      throw new BadRequestException('bad');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad' });
  });

  it('returns 401 for UnauthorizedException', async () => {
    const handler = handleAsync(async () => {
      throw new UnauthorizedException();
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 404 for NotFoundException', async () => {
    const handler = handleAsync(async () => {
      throw new NotFoundException('missing');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'missing' });
  });

  it('returns 500 and logs for unknown errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = handleAsync(async () => {
      throw new Error('boom');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('passes extra args (params) to the handler', async () => {
    const handler = handleAsync(
      async (_req: NextRequest, ctx: { params: { id: string } }) =>
        NextResponse.json({ id: ctx.params.id })
    );
    const res = await handler(makeRequest(), { params: { id: 'abc' } } as any);
    expect(await res.json()).toEqual({ id: 'abc' });
  });
});

describe('handleAsyncAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when session is null', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const handler = handleAsyncAuth(async (_req, _session) =>
      NextResponse.json({ ok: true })
    );
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
  });

  it('injects session into handler when session exists', async () => {
    const fakeSession = { user: { id: 'user-1', name: 'Test' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);
    const handler = handleAsyncAuth(async (_req, session) =>
      NextResponse.json({ userId: session.user.id })
    );
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user-1' });
  });
});
