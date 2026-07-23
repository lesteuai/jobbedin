import { NextResponse } from 'next/server';
import { makeRequest } from '@/test/next-request';
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  handleAsync,
  handleAsyncAuth,
} from '@/app/lib/api-handler';
import { auth } from '@/app/lib/auth';

vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

const getSessionMock = vi.mocked(auth.api.getSession);

describe('exception classes', () => {
  it('BadRequestException has correct name, default message, and is an Error', () => {
    const error = new BadRequestException();
    expect(error.name).toBe('BadRequestException');
    expect(error.message).toBe('Bad request');
    expect(error).toBeInstanceOf(Error);
  });

  it('BadRequestException accepts a custom message', () => {
    const error = new BadRequestException('custom bad request');
    expect(error.message).toBe('custom bad request');
  });

  it('UnauthorizedException has correct name, default message, and is an Error', () => {
    const error = new UnauthorizedException();
    expect(error.name).toBe('UnauthorizedException');
    expect(error.message).toBe('Unauthorized');
    expect(error).toBeInstanceOf(Error);
  });

  it('UnauthorizedException accepts a custom message', () => {
    const error = new UnauthorizedException('custom unauthorized');
    expect(error.message).toBe('custom unauthorized');
  });

  it('NotFoundException has correct name, default message, and is an Error', () => {
    const error = new NotFoundException();
    expect(error.name).toBe('NotFoundException');
    expect(error.message).toBe('Not found');
    expect(error).toBeInstanceOf(Error);
  });

  it('NotFoundException accepts a custom message', () => {
    const error = new NotFoundException('custom not found');
    expect(error.message).toBe('custom not found');
  });
});

describe('handleAsync', () => {
  it('passes through a NextResponse returned by the handler unchanged', async () => {
    const handler = handleAsync(async () => NextResponse.json({ ok: true }, { status: 201 }));
    const response = await handler(makeRequest('http://localhost:3000/api/test'));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('converts BadRequestException to a 400 with the exception message', async () => {
    const handler = handleAsync(async () => {
      throw new BadRequestException('missing field');
    });
    const response = await handler(makeRequest('http://localhost:3000/api/test'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'missing field' });
  });

  it('converts UnauthorizedException to a 401 with the exception message', async () => {
    const handler = handleAsync(async () => {
      throw new UnauthorizedException('no token');
    });
    const response = await handler(makeRequest('http://localhost:3000/api/test'));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'no token' });
  });

  it('converts NotFoundException to a 404 with the exception message', async () => {
    const handler = handleAsync(async () => {
      throw new NotFoundException('no such resource');
    });
    const response = await handler(makeRequest('http://localhost:3000/api/test'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'no such resource' });
  });

  it('converts an unknown Error to a 500 without leaking the internal message', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = handleAsync(async () => {
      throw new Error('sensitive internal detail');
    });
    const response = await handler(makeRequest('http://localhost:3000/api/test'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('converts a thrown string to a 500 without leaking it into the response body', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = handleAsync(async () => {
      throw 'sensitive string error';
    });
    const response = await handler(makeRequest('http://localhost:3000/api/test'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('forwards extra route args to the wrapped handler', async () => {
    const ctx = { params: { id: '123' } };
    const handler = handleAsync(async (request, receivedCtx: typeof ctx) => {
      return NextResponse.json({ params: receivedCtx.params });
    });
    const response = await handler(makeRequest('http://localhost:3000/api/test'), ctx);
    expect(await response.json()).toEqual({ params: { id: '123' } });
  });
});

describe('handleAsyncAuth', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it('calls the wrapped handler with the session and forwards extra args as the third argument', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    getSessionMock.mockResolvedValue(fakeSession as never);
    const ctx = { params: { id: '456' } };

    const wrappedHandler = vi.fn(async (request, session, receivedCtx: typeof ctx) => {
      return NextResponse.json({ session, params: receivedCtx.params });
    });
    const handler = handleAsyncAuth(wrappedHandler);
    const response = await handler(makeRequest('http://localhost:3000/api/test'), ctx);

    expect(wrappedHandler).toHaveBeenCalled();
    const callArgs = wrappedHandler.mock.calls[0];
    expect(callArgs[1]).toBe(fakeSession);
    expect(callArgs[2]).toBe(ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ session: fakeSession, params: { id: '456' } });
  });

  it('returns 401 without invoking the handler when getSession resolves to null', async () => {
    getSessionMock.mockResolvedValue(null as never);
    const wrappedHandler = vi.fn(async () => NextResponse.json({ ok: true }));

    const handler = handleAsyncAuth(wrappedHandler);
    const response = await handler(makeRequest('http://localhost:3000/api/test'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(wrappedHandler).not.toHaveBeenCalled();
  });

  it('applies the status mapping when the wrapped handler throws a typed exception', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    getSessionMock.mockResolvedValue(fakeSession as never);

    const handler = handleAsyncAuth(async () => {
      throw new NotFoundException('resource missing');
    });
    const response = await handler(makeRequest('http://localhost:3000/api/test'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'resource missing' });
  });
});
