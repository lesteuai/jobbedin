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

vi.mock('pdf-parse/worker');
vi.mock('pdf-parse');

import { auth } from '@/app/lib/auth';
import { db } from '@/app/lib/db';

function makeRequest(method: string, url: string, body?: any) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/resumes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('GET', 'http://localhost/api/resumes');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns user-scoped resume list when authenticated', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const resumeList = [
      {
        id: 'resume-1',
        name: 'Resume 1',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      },
    ];

    const mockOrderBy = vi.fn().mockResolvedValue(resumeList);
    const mockWhere = vi.fn().mockReturnValue({
      orderBy: mockOrderBy,
    });
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    });
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    });

    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('GET', 'http://localhost/api/resumes');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].id).toBe('resume-1');
    expect(json[0].name).toBe('Resume 1');
    expect(mockWhere).toHaveBeenCalled();
  });
});

describe('POST /api/resumes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/resumes', {
      method: 'POST',
      body: 'empty',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const req = new NextRequest('http://localhost/api/resumes', {
      method: 'POST',
    });

    vi.spyOn(req, 'formData').mockResolvedValue(new FormData());

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('No file provided');
  });

  it('returns 400 for unsupported file type', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const formData = new FormData();
    formData.append('file', new File(['content'], 'resume.docx', { type: 'application/vnd.ms-word' }));

    const req = new NextRequest('http://localhost/api/resumes', {
      method: 'POST',
    });
    vi.spyOn(req, 'formData').mockResolvedValue(formData);

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Unsupported file type');
  });

  it('returns 201 with id for valid .txt file', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const formData = new FormData();
    formData.append('file', new File(['hello world'], 'resume.txt', { type: 'text/plain' }));

    const req = new NextRequest('http://localhost/api/resumes', {
      method: 'POST',
    });
    vi.spyOn(req, 'formData').mockResolvedValue(formData);

    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('id');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('returns 201 with id for valid .md file', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const formData = new FormData();
    formData.append('file', new File(['# Resume'], 'resume.md', { type: 'text/markdown' }));

    const req = new NextRequest('http://localhost/api/resumes', {
      method: 'POST',
    });
    vi.spyOn(req, 'formData').mockResolvedValue(formData);

    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('id');
  });

  it('inserts resume with correct userId', async () => {
    const fakeSession = { user: { id: 'user-123' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const formData = new FormData();
    formData.append('file', new File(['content'], 'my-resume.txt', { type: 'text/plain' }));

    const req = new NextRequest('http://localhost/api/resumes', {
      method: 'POST',
    });
    vi.spyOn(req, 'formData').mockResolvedValue(formData);

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        name: 'my-resume',
        content: 'content',
      })
    );
  });
});
