import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '@/test/db-mock';
import { makeRequest, makeJsonRequest } from '@/test/next-request';

const dbMock = createDbMock();

vi.mock('@/app/lib/db', () => ({ db: dbMock }));
vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(() => Promise.resolve({ user: { id: 'user-1' } })),
    },
  },
}));

const JOBS_URL = 'http://localhost:3000/api/jobs';

function getInsertValues(): Record<string, unknown> {
  const call = dbMock.calls.insert.at(-1);
  return (call?.values[0] as Record<string, unknown>) ?? {};
}

beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
});

describe('GET /api/jobs', () => {
  it('returns 400 naming resumeId when missing', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest(JOBS_URL));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('resumeId');
  });

  it('returns the rows the select resolved to, scoped to resumeId and session user', async () => {
    const rows = [{ id: 'job-1', name: 'Job 1', resumeId: 'r1', createdAt: 'now', updatedAt: 'now' }];
    dbMock.queueResult(rows);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(`${JOBS_URL}?resumeId=r1`));
    const body = await response.json();

    expect(body).toEqual(rows);
    const selectCall = dbMock.calls.select.at(-1);
    expect(selectCall?.where[0]).toBeDefined();
  });
});

describe('POST /api/jobs', () => {
  it('returns 400 when resumeId is missing', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeJsonRequest(JOBS_URL, { content: 'hello' }));

    expect(response.status).toBe(400);
  });

  it('returns 400 when content is missing', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeJsonRequest(JOBS_URL, { resumeId: 'r1' }));

    expect(response.status).toBe(400);
  });

  it('returns 400 when content is an empty string', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeJsonRequest(JOBS_URL, { resumeId: 'r1', content: '' }));

    expect(response.status).toBe(400);
  });

  it('returns 201 with the inserted row from returning()', async () => {
    dbMock.queueResult([{ count: 0 }]);
    const insertedRow = { id: 'job-1', name: 'Job 1', content: 'hello', resumeId: 'r1', createdAt: 'now' };
    dbMock.queueResult([insertedRow]);

    const { POST } = await import('./route');
    const response = await POST(makeJsonRequest(JOBS_URL, { resumeId: 'r1', content: 'hello' }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual(insertedRow);
  });

  it('names the job "Job 1" when the existing count is 0', async () => {
    dbMock.queueResult([{ count: 0 }]);
    dbMock.queueResult([{ id: 'job-1', name: 'Job 1' }]);

    const { POST } = await import('./route');
    await POST(makeJsonRequest(JOBS_URL, { resumeId: 'r1', content: 'hello' }));

    expect(getInsertValues().name).toBe('Job 1');
  });

  it('names the job "Job 5" when the existing count is 4', async () => {
    dbMock.queueResult([{ count: 4 }]);
    dbMock.queueResult([{ id: 'job-5', name: 'Job 5' }]);

    const { POST } = await import('./route');
    await POST(makeJsonRequest(JOBS_URL, { resumeId: 'r1', content: 'hello' }));

    expect(getInsertValues().name).toBe('Job 5');
  });

  it('defensively names the job "Job 1" when the count select resolves to an empty array', async () => {
    dbMock.queueResult([]);
    dbMock.queueResult([{ id: 'job-1', name: 'Job 1' }]);

    const { POST } = await import('./route');
    await POST(makeJsonRequest(JOBS_URL, { resumeId: 'r1', content: 'hello' }));

    expect(getInsertValues().name).toBe('Job 1');
  });

  it('carries the session user id on the inserted row', async () => {
    dbMock.queueResult([{ count: 0 }]);
    dbMock.queueResult([{ id: 'job-1', name: 'Job 1' }]);

    const { POST } = await import('./route');
    await POST(makeJsonRequest(JOBS_URL, { resumeId: 'r1', content: 'hello' }));

    expect(getInsertValues().userId).toBe('user-1');
  });
});
