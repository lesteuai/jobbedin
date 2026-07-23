import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock, equalityComparisons } from '@/test/db-mock';
import { makeRequest } from '@/test/next-request';

const dbMock = createDbMock();

vi.mock('@/app/lib/db', () => ({ db: dbMock }));
vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(() => Promise.resolve({ user: { id: 'user-1' } })),
    },
  },
}));

const RESUME_URL = 'http://localhost:3000/api/resumes/r1';

beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
});

describe('GET /api/resumes/[id]', () => {
  it('returns 400 when id is empty', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest(RESUME_URL), { params: Promise.resolve({ id: '' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 for an unknown resume or one owned by another user', async () => {
    dbMock.queueResult([]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(RESUME_URL), { params: Promise.resolve({ id: 'r1' }) });

    expect(response.status).toBe(404);
  });

  it('returns the found resume as the response body', async () => {
    const resume = { id: 'r1', name: 'Resume 1', userId: 'user-1' };
    dbMock.queueResult([resume]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(RESUME_URL), { params: Promise.resolve({ id: 'r1' }) });
    const body = await response.json();

    expect(body).toEqual(resume);
  });

  it('scopes the resume lookup to the id and the session user', async () => {
    dbMock.queueResult([{ id: 'r1' }]);

    const { GET } = await import('./route');
    await GET(makeRequest(RESUME_URL), { params: Promise.resolve({ id: 'r1' }) });

    const comparisons = equalityComparisons(dbMock.calls.select.at(-1)?.where[0]);
    expect(comparisons).toContainEqual({ column: 'id', value: 'r1' });
    expect(comparisons).toContainEqual({ column: 'user_id', value: 'user-1' });
  });
});

describe('DELETE /api/resumes/[id]', () => {
  it('returns 400 when id is empty', async () => {
    const { DELETE } = await import('./route');
    const response = await DELETE(makeRequest(RESUME_URL, { method: 'DELETE' }), {
      params: Promise.resolve({ id: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 404 and issues no delete call for an unknown resume', async () => {
    dbMock.queueResult([]);

    const { DELETE } = await import('./route');
    const response = await DELETE(makeRequest(RESUME_URL, { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'r1' }),
    });

    expect(response.status).toBe(404);
    expect(dbMock.calls.delete).toHaveLength(0);
  });

  it('returns success and issues exactly one delete call for a found resume', async () => {
    dbMock.queueResult([{ id: 'r1', name: 'Resume 1', userId: 'user-1' }]);

    const { DELETE } = await import('./route');
    const response = await DELETE(makeRequest(RESUME_URL, { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'r1' }),
    });
    const body = await response.json();

    expect(body).toEqual({ success: true });
    expect(dbMock.calls.delete).toHaveLength(1);
  });
});
