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

const JOB_URL = 'http://localhost:3000/api/jobs/job-1';

beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
});

describe('GET /api/jobs/[id]', () => {
  it('returns 400 when id is empty', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest(JOB_URL), { params: Promise.resolve({ id: '' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 for an unknown job or one owned by another user', async () => {
    dbMock.queueResult([]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(JOB_URL), { params: Promise.resolve({ id: 'job-1' }) });

    expect(response.status).toBe(404);
  });

  it('returns the found job as the response body', async () => {
    const job = { id: 'job-1', name: 'Job 1', userId: 'user-1' };
    dbMock.queueResult([job]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(JOB_URL), { params: Promise.resolve({ id: 'job-1' }) });
    const body = await response.json();

    expect(body).toEqual(job);
  });

  it('scopes the job lookup to the id and the session user', async () => {
    dbMock.queueResult([{ id: 'job-1' }]);

    const { GET } = await import('./route');
    await GET(makeRequest(JOB_URL), { params: Promise.resolve({ id: 'job-1' }) });

    const comparisons = equalityComparisons(dbMock.calls.select.at(-1)?.where[0]);
    expect(comparisons).toContainEqual({ column: 'id', value: 'job-1' });
    expect(comparisons).toContainEqual({ column: 'user_id', value: 'user-1' });
  });
});

describe('DELETE /api/jobs/[id]', () => {
  it('returns 400 when id is empty', async () => {
    const { DELETE } = await import('./route');
    const response = await DELETE(makeRequest(JOB_URL, { method: 'DELETE' }), {
      params: Promise.resolve({ id: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 404 and issues no delete call for an unknown job', async () => {
    dbMock.queueResult([]);

    const { DELETE } = await import('./route');
    const response = await DELETE(makeRequest(JOB_URL, { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'job-1' }),
    });

    expect(response.status).toBe(404);
    expect(dbMock.calls.delete).toHaveLength(0);
  });

  it('returns success and issues exactly one delete call for a found job', async () => {
    dbMock.queueResult([{ id: 'job-1', name: 'Job 1', userId: 'user-1' }]);

    const { DELETE } = await import('./route');
    const response = await DELETE(makeRequest(JOB_URL, { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'job-1' }),
    });
    const body = await response.json();

    expect(body).toEqual({ success: true });
    expect(dbMock.calls.delete).toHaveLength(1);
  });
});
