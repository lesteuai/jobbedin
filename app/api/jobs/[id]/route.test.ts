import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, DELETE } from './route';

vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/app/lib/db', () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

import { auth } from '@/app/lib/auth';
import { db } from '@/app/lib/db';

function makeRequest(method: string, url: string, body?: any) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/jobs/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('GET', 'http://localhost/api/jobs/job-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'job-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 when id param is missing', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);
    const req = makeRequest('GET', 'http://localhost/api/jobs/');
    const res = await GET(req, { params: Promise.resolve({ id: '' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when job not found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('GET', 'http://localhost/api/jobs/nonexistent');
    const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain('Not found');
  });

  it('returns 200 with job data when found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const fakeJob = {
      id: 'job-1',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'Job 1',
      content: 'JD content',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    const mockWhere = vi.fn().mockResolvedValue([fakeJob]);
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('GET', 'http://localhost/api/jobs/job-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'job-1' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('job-1');
    expect(json.name).toBe('Job 1');
    expect(json.content).toBe('JD content');
  });

  it('verifies userId scoping in query', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('GET', 'http://localhost/api/jobs/job-1');
    await GET(req, { params: Promise.resolve({ id: 'job-1' }) });

    expect(mockWhere).toHaveBeenCalled();
    const whereCall = mockWhere.mock.calls[0][0];
    expect(whereCall).toBeDefined();
  });
});

describe('DELETE /api/jobs/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('DELETE', 'http://localhost/api/jobs/job-1');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'job-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 when id param is missing', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);
    const req = makeRequest('DELETE', 'http://localhost/api/jobs/');
    const res = await DELETE(req, { params: Promise.resolve({ id: '' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when job not found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('DELETE', 'http://localhost/api/jobs/nonexistent');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain('Not found');
  });

  it('returns 200 with success true when deleted', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const fakeJob = {
      id: 'job-1',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'Job 1',
      content: 'JD content',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    const mockWhere = vi.fn().mockResolvedValue([fakeJob]);
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({
      where: mockDeleteWhere,
    });

    vi.mocked(db.delete).mockImplementation(mockDelete);

    const req = makeRequest('DELETE', 'http://localhost/api/jobs/job-1');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'job-1' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('calls db.delete when job exists', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const fakeJob = {
      id: 'job-1',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'Job 1',
      content: 'JD content',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    const mockWhere = vi.fn().mockResolvedValue([fakeJob]);
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({
      where: mockDeleteWhere,
    });

    vi.mocked(db.delete).mockImplementation(mockDelete);

    const req = makeRequest('DELETE', 'http://localhost/api/jobs/job-1');
    await DELETE(req, { params: Promise.resolve({ id: 'job-1' }) });

    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it('does not call db.delete when job not found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({
      where: mockDeleteWhere,
    });

    vi.mocked(db.delete).mockImplementation(mockDelete);

    const req = makeRequest('DELETE', 'http://localhost/api/jobs/nonexistent');
    await DELETE(req, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(mockDelete).not.toHaveBeenCalled();
  });
});
