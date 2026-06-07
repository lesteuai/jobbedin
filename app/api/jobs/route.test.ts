import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

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
    insert: vi.fn(),
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

describe('GET /api/jobs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('GET', 'http://localhost/api/jobs?resumeId=resume-1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when resumeId query param is missing', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);
    const req = makeRequest('GET', 'http://localhost/api/jobs');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('resumeId query parameter is required');
  });

  it('returns user-scoped job list when authenticated', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue([
        {
          id: 'job-1',
          name: 'Job 1',
          resumeId: 'resume-1',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
        {
          id: 'job-2',
          name: 'Job 2',
          resumeId: 'resume-1',
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
        },
      ]),
    });
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('GET', 'http://localhost/api/jobs?resumeId=resume-1');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].name).toBe('Job 1');
    expect(json[1].name).toBe('Job 2');
    expect(mockWhere).toHaveBeenCalled();
  });

  it('returns empty list when no jobs exist for resumeId', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue([]),
    });
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('GET', 'http://localhost/api/jobs?resumeId=resume-1');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([]);
  });
});

describe('POST /api/jobs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('POST', 'http://localhost/api/jobs', {
      resumeId: 'resume-1',
      content: 'JD content',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when resumeId is missing', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);
    const req = makeRequest('POST', 'http://localhost/api/jobs', {
      content: 'JD content',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('resumeId and content are required');
  });

  it('returns 400 when content is missing', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);
    const req = makeRequest('POST', 'http://localhost/api/jobs', {
      resumeId: 'resume-1',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('resumeId and content are required');
  });

  it('names first job "Job 1" when no existing jobs', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: 'job-1',
          name: 'Job 1',
          content: 'JD content',
          resumeId: 'resume-1',
          createdAt: new Date('2025-01-01'),
        },
      ]),
    });
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const req = makeRequest('POST', 'http://localhost/api/jobs', {
      resumeId: 'resume-1',
      content: 'JD content',
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe('Job 1');
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Job 1',
        resumeId: 'resume-1',
        content: 'JD content',
        userId: 'user-1',
      })
    );
  });

  it('names second job "Job 2" when one existing job', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([{ count: 1 }]);
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: 'job-2',
          name: 'Job 2',
          content: 'JD content',
          resumeId: 'resume-1',
          createdAt: new Date('2025-01-02'),
        },
      ]),
    });
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const req = makeRequest('POST', 'http://localhost/api/jobs', {
      resumeId: 'resume-1',
      content: 'JD content',
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe('Job 2');
  });

  it('returns 201 with job data when successful', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: 'job-uuid-123',
          name: 'Job 1',
          content: 'JD content here',
          resumeId: 'resume-1',
          createdAt: new Date('2025-01-01'),
        },
      ]),
    });
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const req = makeRequest('POST', 'http://localhost/api/jobs', {
      resumeId: 'resume-1',
      content: 'JD content here',
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('id');
    expect(json).toHaveProperty('name');
    expect(json).toHaveProperty('content');
    expect(json).toHaveProperty('resumeId');
    expect(json).toHaveProperty('createdAt');
  });

  it('inserts job with correct userId', async () => {
    const fakeSession = { user: { id: 'user-123' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockValues = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: 'job-1',
          name: 'Job 1',
          content: 'JD',
          resumeId: 'resume-1',
          createdAt: new Date('2025-01-01'),
        },
      ]),
    });
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const req = makeRequest('POST', 'http://localhost/api/jobs', {
      resumeId: 'resume-1',
      content: 'JD',
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        resumeId: 'resume-1',
      })
    );
  });
});
