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
    delete: vi.fn(),
  },
}));

vi.mock('@langchain/openai', () => {
  const mockInvoke = vi.fn().mockResolvedValue({ content: 'AI generated response' });
  return {
    ChatOpenAI: class {
      invoke = mockInvoke;
    },
  };
});

vi.mock('@/app/lib/system-prompt', () => ({
  generate_letter_prompt: 'Generate a cover letter',
  generate_msg_prompt: 'Generate a recruiter message',
}));

import { auth } from '@/app/lib/auth';
import { db } from '@/app/lib/db';

function makeRequest(method: string, url: string, body?: any) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/jobs/[id]/chat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('GET', 'http://localhost/api/jobs/test-job/chat?mode=letter');
    const res = await GET(req, { params: Promise.resolve({ id: 'test-job' }) } as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when mode is missing', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const req = makeRequest('GET', 'http://localhost/api/jobs/test-job/chat');
    const res = await GET(req, { params: Promise.resolve({ id: 'test-job' }) } as any);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid mode');
  });

  it('returns 400 when mode is invalid', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const req = makeRequest('GET', 'http://localhost/api/jobs/test-job/chat?mode=invalid');
    const res = await GET(req, { params: Promise.resolve({ id: 'test-job' }) } as any);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid mode');
  });

  it('returns 404 when job not found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('GET', 'http://localhost/api/jobs/missing-job/chat?mode=letter');
    const res = await GET(req, { params: Promise.resolve({ id: 'missing-job' }) } as any);

    expect(res.status).toBe(404);
  });

  it('returns empty conversation when no history exists', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockJobWhere = vi.fn().mockResolvedValue([{ id: 'job-1', userId: 'user-1' }]);
    const mockJobFrom = vi.fn().mockReturnValue({ where: mockJobWhere });

    const mockHistoryWhere = vi.fn().mockResolvedValue([]);
    const mockHistoryFrom = vi.fn().mockReturnValue({ where: mockHistoryWhere });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockJobFrom } as any)
      .mockReturnValueOnce({ from: mockHistoryFrom } as any);

    const req = makeRequest('GET', 'http://localhost/api/jobs/job-1/chat?mode=letter');
    const res = await GET(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversation).toEqual([]);
  });

  it('returns conversation when history exists for letter mode', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const conversation = [
      { role: 'user', text: 'Make it shorter' },
      { role: 'ai', text: 'Here is a shorter version...' },
    ];

    const mockJobWhere = vi.fn().mockResolvedValue([{ id: 'job-1', userId: 'user-1' }]);
    const mockJobFrom = vi.fn().mockReturnValue({ where: mockJobWhere });

    const mockHistoryWhere = vi.fn().mockResolvedValue([
      { jobId: 'job-1', userId: 'user-1', conversation },
    ]);
    const mockHistoryFrom = vi.fn().mockReturnValue({ where: mockHistoryWhere });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockJobFrom } as any)
      .mockReturnValueOnce({ from: mockHistoryFrom } as any);

    const req = makeRequest('GET', 'http://localhost/api/jobs/job-1/chat?mode=letter');
    const res = await GET(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversation).toEqual(conversation);
  });

  it('returns conversation when history exists for message mode', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const conversation = [
      { role: 'user', text: 'Make it more formal' },
      { role: 'ai', text: 'Dear hiring manager...' },
    ];

    const mockJobWhere = vi.fn().mockResolvedValue([{ id: 'job-1', userId: 'user-1' }]);
    const mockJobFrom = vi.fn().mockReturnValue({ where: mockJobWhere });

    const mockHistoryWhere = vi.fn().mockResolvedValue([
      { jobId: 'job-1', userId: 'user-1', conversation },
    ]);
    const mockHistoryFrom = vi.fn().mockReturnValue({ where: mockHistoryWhere });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockJobFrom } as any)
      .mockReturnValueOnce({ from: mockHistoryFrom } as any);

    const req = makeRequest('GET', 'http://localhost/api/jobs/job-1/chat?mode=message');
    const res = await GET(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.conversation).toEqual(conversation);
  });
});

describe('POST /api/jobs/[id]/chat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('POST', 'http://localhost/api/jobs/test-job/chat', {
      mode: 'letter',
      userMessage: 'Make it shorter',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'test-job' }) } as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when mode is missing', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const req = makeRequest('POST', 'http://localhost/api/jobs/test-job/chat', {
      userMessage: 'Make it shorter',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'test-job' }) } as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when mode is invalid', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const req = makeRequest('POST', 'http://localhost/api/jobs/test-job/chat', {
      mode: 'invalid',
      userMessage: 'text',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'test-job' }) } as any);

    expect(res.status).toBe(400);
  });

  it('returns 404 when job not found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('POST', 'http://localhost/api/jobs/missing-job/chat', {
      mode: 'letter',
      userMessage: 'Generate a letter',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'missing-job' }) } as any);

    expect(res.status).toBe(404);
  });

  it('clears and saves conversation when only conversation array provided', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockJobWhere = vi.fn().mockResolvedValue([{ id: 'job-1', userId: 'user-1' }]);
    const mockJobFrom = vi.fn().mockReturnValue({ where: mockJobWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockJobFrom });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.delete).mockImplementation(mockDelete);

    const newConversation = [
      { role: 'user', text: 'Start fresh' },
      { role: 'ai', text: 'New response' },
    ];

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-1/chat', {
      mode: 'letter',
      conversation: newConversation,
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      jobId: 'job-1',
      userId: 'user-1',
      conversation: newConversation,
    });
  });

  it('returns 400 when conversation is not an array', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockJobWhere = vi.fn().mockResolvedValue([{ id: 'job-1', userId: 'user-1' }]);
    const mockJobFrom = vi.fn().mockReturnValue({ where: mockJobWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockJobFrom });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-1/chat', {
      mode: 'letter',
      conversation: 'not-an-array',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('conversation must be an array');
  });

  it('sends message to LLM and saves reply for letter mode', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockJobVerifyWhere = vi.fn().mockResolvedValue([
      { id: 'job-1', userId: 'user-1', resumeId: 'resume-1', content: 'Job description' },
    ]);
    const mockJobVerifyFrom = vi.fn().mockReturnValue({ where: mockJobVerifyWhere });

    const mockHistoryWhere = vi.fn().mockResolvedValue([]);
    const mockHistoryFrom = vi.fn().mockReturnValue({ where: mockHistoryWhere });

    const mockCompanyWhere = vi.fn().mockResolvedValue([
      { jobId: 'job-1', content: 'Company info' },
    ]);
    const mockCompanyFrom = vi.fn().mockReturnValue({ where: mockCompanyWhere });

    const mockJDWhere = vi.fn().mockResolvedValue([
      { jobId: 'job-1', content: 'JD match' },
    ]);
    const mockJDFrom = vi.fn().mockReturnValue({ where: mockJDWhere });

    const mockResumeWhere = vi.fn().mockResolvedValue([
      { id: 'resume-1', content: 'Resume text' },
    ]);
    const mockResumeFrom = vi.fn().mockReturnValue({ where: mockResumeWhere });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockJobVerifyFrom } as any)
      .mockReturnValueOnce({ from: mockHistoryFrom } as any)
      .mockReturnValueOnce({ from: mockCompanyFrom } as any)
      .mockReturnValueOnce({ from: mockJDFrom } as any)
      .mockReturnValueOnce({ from: mockResumeFrom } as any);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.delete).mockImplementation(mockDelete);

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-1/chat', {
      mode: 'letter',
      userMessage: 'Make it shorter',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBe('AI generated response');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('sends message to LLM and saves reply for message mode', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockJobVerifyWhere = vi.fn().mockResolvedValue([
      { id: 'job-1', userId: 'user-1', resumeId: 'resume-1', content: 'Job description' },
    ]);
    const mockJobVerifyFrom = vi.fn().mockReturnValue({ where: mockJobVerifyWhere });

    const mockHistoryWhere = vi.fn().mockResolvedValue([]);
    const mockHistoryFrom = vi.fn().mockReturnValue({ where: mockHistoryWhere });

    const mockCompanyWhere = vi.fn().mockResolvedValue([
      { jobId: 'job-1', content: 'Company info' },
    ]);
    const mockCompanyFrom = vi.fn().mockReturnValue({ where: mockCompanyWhere });

    const mockJDWhere = vi.fn().mockResolvedValue([
      { jobId: 'job-1', content: 'JD match' },
    ]);
    const mockJDFrom = vi.fn().mockReturnValue({ where: mockJDWhere });

    const mockResumeWhere = vi.fn().mockResolvedValue([
      { id: 'resume-1', content: 'Resume text' },
    ]);
    const mockResumeFrom = vi.fn().mockReturnValue({ where: mockResumeWhere });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockJobVerifyFrom } as any)
      .mockReturnValueOnce({ from: mockHistoryFrom } as any)
      .mockReturnValueOnce({ from: mockCompanyFrom } as any)
      .mockReturnValueOnce({ from: mockJDFrom } as any)
      .mockReturnValueOnce({ from: mockResumeFrom } as any);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.delete).mockImplementation(mockDelete);

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-1/chat', {
      mode: 'message',
      userMessage: 'Make it professional',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBe('AI generated response');
  });

  it('uses existing conversation history when sending message', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const existingConversation = [
      { role: 'user', text: 'Initial request' },
      { role: 'ai', text: 'Initial response' },
    ];

    const mockJobVerifyWhere = vi.fn().mockResolvedValue([
      { id: 'job-1', userId: 'user-1', resumeId: 'resume-1', content: 'Job description' },
    ]);
    const mockJobVerifyFrom = vi.fn().mockReturnValue({ where: mockJobVerifyWhere });

    const mockHistoryWhere = vi.fn().mockResolvedValue([
      { jobId: 'job-1', conversation: existingConversation },
    ]);
    const mockHistoryFrom = vi.fn().mockReturnValue({ where: mockHistoryWhere });

    const mockCompanyWhere = vi.fn().mockResolvedValue([
      { jobId: 'job-1', content: 'Company info' },
    ]);
    const mockCompanyFrom = vi.fn().mockReturnValue({ where: mockCompanyWhere });

    const mockJDWhere = vi.fn().mockResolvedValue([
      { jobId: 'job-1', content: 'JD match' },
    ]);
    const mockJDFrom = vi.fn().mockReturnValue({ where: mockJDWhere });

    const mockResumeWhere = vi.fn().mockResolvedValue([
      { id: 'resume-1', content: 'Resume text' },
    ]);
    const mockResumeFrom = vi.fn().mockReturnValue({ where: mockResumeWhere });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockJobVerifyFrom } as any)
      .mockReturnValueOnce({ from: mockHistoryFrom } as any)
      .mockReturnValueOnce({ from: mockCompanyFrom } as any)
      .mockReturnValueOnce({ from: mockJDFrom } as any)
      .mockReturnValueOnce({ from: mockResumeFrom } as any);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.delete).mockImplementation(mockDelete);

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-1/chat', {
      mode: 'letter',
      userMessage: 'Follow-up request',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBe('AI generated response');
    expect(mockValues).toHaveBeenCalledWith({
      jobId: 'job-1',
      userId: 'user-1',
      conversation: [
        { role: 'user', text: 'Initial request' },
        { role: 'ai', text: 'Initial response' },
        { role: 'user', text: 'Follow-up request' },
        { role: 'ai', text: 'AI generated response' },
      ],
    });
  });

  it('returns 400 when neither userMessage nor conversation provided', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const mockJobWhere = vi.fn().mockResolvedValue([{ id: 'job-1', userId: 'user-1' }]);
    const mockJobFrom = vi.fn().mockReturnValue({ where: mockJobWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockJobFrom });
    vi.mocked(db.select).mockImplementation(mockSelect);

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-1/chat', {
      mode: 'letter',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Either userMessage or conversation must be provided');
  });
});
