import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { ProcessStatus, ProcessType } from '@/app/lib/db/schema';

vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/app/lib/db', () => ({
  db: {
    query: {
      resumeJob: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { auth } from '@/app/lib/auth';
import { db } from '@/app/lib/db';

function makeRequest(method: string, url: string) {
  return new NextRequest(url, { method });
}

describe('GET /api/jobs/[id]/analysis', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('GET', 'http://localhost/api/jobs/test-job/analysis');
    const res = await GET(req, { params: Promise.resolve({ id: 'test-job' }) } as any);
    expect(res.status).toBe(401);
  });

  it('returns 404 when job not found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);
    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(null);

    const req = makeRequest('GET', 'http://localhost/api/jobs/missing-job/analysis');
    const res = await GET(req, { params: Promise.resolve({ id: 'missing-job' }) } as any);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Not found');
  });

  it('returns analysis with all fields when job found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const jobWithAnalysis = {
      id: 'job-1',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'Test Job',
      content: 'Job description',
      createdAt: new Date(),
      updatedAt: new Date(),
      company: {
        id: 'c1',
        jobId: 'job-1',
        userId: 'user-1',
        content: 'Company research results',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      jobDescriptionMatch: {
        id: 'jd1',
        jobId: 'job-1',
        userId: 'user-1',
        content: 'JD match analysis',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      resumeFeedback: {
        id: 'rf1',
        jobId: 'job-1',
        userId: 'user-1',
        content: 'Resume feedback',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      coverLetterHistory: {
        jobId: 'job-1',
        userId: 'user-1',
        conversation: [{ role: 'user', text: 'Generate a letter' }, { role: 'ai', text: 'Dear hiring...' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      messageGenHistory: {
        jobId: 'job-1',
        userId: 'user-1',
        conversation: [{ role: 'user', text: 'Generate a message' }, { role: 'ai', text: 'Hi there...' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      processes: [
        { id: 'p1', userId: 'user-1', jobId: 'job-1', processType: ProcessType.Company, status: ProcessStatus.Done, createdAt: new Date(), updatedAt: new Date() },
        { id: 'p2', userId: 'user-1', jobId: 'job-1', processType: ProcessType.JDMatch, status: ProcessStatus.Done, createdAt: new Date(), updatedAt: new Date() },
        { id: 'p3', userId: 'user-1', jobId: 'job-1', processType: ProcessType.ResumeFeedback, status: ProcessStatus.Done, createdAt: new Date(), updatedAt: new Date() },
        { id: 'p4', userId: 'user-1', jobId: 'job-1', processType: ProcessType.Letter, status: ProcessStatus.Processing, createdAt: new Date(), updatedAt: new Date() },
        { id: 'p5', userId: 'user-1', jobId: 'job-1', processType: ProcessType.Message, status: ProcessStatus.Pending, createdAt: new Date(), updatedAt: new Date() },
      ],
    };

    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(jobWithAnalysis as any);

    const req = makeRequest('GET', 'http://localhost/api/jobs/job-1/analysis');
    const res = await GET(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      company: 'Company research results',
      jdMatch: 'JD match analysis',
      feedback: 'Resume feedback',
      letterConversation: [{ role: 'user', text: 'Generate a letter' }, { role: 'ai', text: 'Dear hiring...' }],
      messageConversation: [{ role: 'user', text: 'Generate a message' }, { role: 'ai', text: 'Hi there...' }],
      processes: [
        { processType: ProcessType.Company, status: ProcessStatus.Done },
        { processType: ProcessType.JDMatch, status: ProcessStatus.Done },
        { processType: ProcessType.ResumeFeedback, status: ProcessStatus.Done },
        { processType: ProcessType.Letter, status: ProcessStatus.Processing },
        { processType: ProcessType.Message, status: ProcessStatus.Pending },
      ],
    });
  });

  it('returns null for missing company content', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const jobWithoutCompany = {
      id: 'job-2',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'Job',
      content: 'Job desc',
      createdAt: new Date(),
      updatedAt: new Date(),
      company: null,
      jobDescriptionMatch: null,
      resumeFeedback: null,
      coverLetterHistory: null,
      messageGenHistory: null,
      processes: [],
    };

    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(jobWithoutCompany as any);

    const req = makeRequest('GET', 'http://localhost/api/jobs/job-2/analysis');
    const res = await GET(req, { params: Promise.resolve({ id: 'job-2' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.company).toBeNull();
    expect(json.jdMatch).toBeNull();
    expect(json.feedback).toBeNull();
    expect(json.letterConversation).toBeNull();
    expect(json.messageConversation).toBeNull();
  });

  it('returns empty conversation array when history exists but conversation is null', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const jobWithEmptyHistories = {
      id: 'job-3',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'Job',
      content: 'Job desc',
      createdAt: new Date(),
      updatedAt: new Date(),
      company: { id: 'c1', jobId: 'job-3', userId: 'user-1', content: null, createdAt: new Date(), updatedAt: new Date() },
      jobDescriptionMatch: { id: 'jd1', jobId: 'job-3', userId: 'user-1', content: null, createdAt: new Date(), updatedAt: new Date() },
      resumeFeedback: { id: 'rf1', jobId: 'job-3', userId: 'user-1', content: null, createdAt: new Date(), updatedAt: new Date() },
      coverLetterHistory: { jobId: 'job-3', userId: 'user-1', conversation: null, createdAt: new Date(), updatedAt: new Date() },
      messageGenHistory: { jobId: 'job-3', userId: 'user-1', conversation: null, createdAt: new Date(), updatedAt: new Date() },
      processes: [],
    };

    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(jobWithEmptyHistories as any);

    const req = makeRequest('GET', 'http://localhost/api/jobs/job-3/analysis');
    const res = await GET(req, { params: Promise.resolve({ id: 'job-3' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.letterConversation).toEqual(null);
    expect(json.messageConversation).toEqual(null);
  });

  it('respects userId scoping in query', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(null);

    const req = makeRequest('GET', 'http://localhost/api/jobs/job-from-other-user/analysis');
    const res = await GET(req, { params: Promise.resolve({ id: 'job-from-other-user' }) } as any);

    expect(res.status).toBe(404);
    expect(vi.mocked(db.query.resumeJob.findFirst)).toHaveBeenCalled();
  });
});
