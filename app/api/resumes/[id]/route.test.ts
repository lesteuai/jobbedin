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

function makeRequest(method: string, url: string) {
  return new NextRequest(url, { method });
}

describe('GET /api/resumes/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('GET', 'http://localhost/api/resumes/resume-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'resume-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when resume not found (wrong userId)', async () => {
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

    const req = makeRequest('GET', 'http://localhost/api/resumes/resume-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'resume-1' }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Not found');
  });

  it('returns 200 with resume when found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const resumeData = {
      id: 'resume-1',
      userId: 'user-1',
      name: 'My Resume',
      content: 'resume content',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    };

    const mockWhere = vi.fn().mockResolvedValue([resumeData]);
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('GET', 'http://localhost/api/resumes/resume-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'resume-1' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('resume-1');
    expect(json.name).toBe('My Resume');
    expect(json.userId).toBe('user-1');
    expect(json.content).toBe('resume content');
  });

  it('includes userId in query filter', async () => {
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

    const req = makeRequest('GET', 'http://localhost/api/resumes/resume-1');
    await GET(req, { params: Promise.resolve({ id: 'resume-1' }) });

    expect(mockWhere).toHaveBeenCalled();
    const whereCall = mockWhere.mock.calls[0][0];
    expect(whereCall).toBeDefined();
  });
});

describe('DELETE /api/resumes/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('DELETE', 'http://localhost/api/resumes/resume-1');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'resume-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when resume not found', async () => {
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

    const req = makeRequest('DELETE', 'http://localhost/api/resumes/resume-1');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'resume-1' }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Not found');
  });

  it('returns 200 with success when resume deleted', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const resumeData = {
      id: 'resume-1',
      userId: 'user-1',
      name: 'My Resume',
      content: 'resume content',
    };

    let selectCallCount = 0;
    const mockSelectWhere = vi.fn().mockImplementation(() => {
      selectCallCount++;
      return [resumeData];
    });
    const mockSelectFrom = vi.fn().mockReturnValue({
      where: mockSelectWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockSelectFrom,
    });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({
      where: mockDeleteWhere,
    });
    vi.mocked(db.delete).mockImplementation(mockDelete);

    const req = makeRequest('DELETE', 'http://localhost/api/resumes/resume-1');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'resume-1' }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it('calls delete with correct resume id', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const resumeData = {
      id: 'resume-1',
      userId: 'user-1',
      name: 'My Resume',
      content: 'resume content',
    };

    const mockSelectWhere = vi.fn().mockResolvedValue([resumeData]);
    const mockSelectFrom = vi.fn().mockReturnValue({
      where: mockSelectWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockSelectFrom,
    });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({
      where: mockDeleteWhere,
    });
    vi.mocked(db.delete).mockImplementation(mockDelete);

    const req = makeRequest('DELETE', 'http://localhost/api/resumes/resume-1');
    await DELETE(req, { params: Promise.resolve({ id: 'resume-1' }) });

    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});
