import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
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
    insert: vi.fn(),
  },
}));

vi.mock('@/app/lib/workflow', () => ({
  runWorkflow: vi.fn(),
}));

import { auth } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import { runWorkflow } from '@/app/lib/workflow';

function makeRequest(method: string, url: string, body?: any) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/jobs/[id]/analyze', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const req = makeRequest('POST', 'http://localhost/api/jobs/test-job/analyze');
    const res = await POST(req, { params: Promise.resolve({ id: 'test-job' }) } as any);
    expect(res.status).toBe(401);
  });

  it('returns 404 when job not found', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);
    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(null);

    const req = makeRequest('POST', 'http://localhost/api/jobs/missing-job/analyze');
    const res = await POST(req, { params: Promise.resolve({ id: 'missing-job' }) } as any);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Not found');
  });

  it('returns 200 with status done when all 5 processes are done', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const completedJob = {
      id: 'job-1',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'Test Job',
      content: 'Job description',
      createdAt: new Date(),
      updatedAt: new Date(),
      resume: { id: 'resume-1', userId: 'user-1', name: 'Resume', content: 'Resume text', createdAt: new Date(), updatedAt: new Date() },
      processes: [
        { id: 'p1', userId: 'user-1', jobId: 'job-1', processType: ProcessType.Company, status: ProcessStatus.Done, createdAt: new Date(), updatedAt: new Date() },
        { id: 'p2', userId: 'user-1', jobId: 'job-1', processType: ProcessType.JDMatch, status: ProcessStatus.Done, createdAt: new Date(), updatedAt: new Date() },
        { id: 'p3', userId: 'user-1', jobId: 'job-1', processType: ProcessType.ResumeFeedback, status: ProcessStatus.Done, createdAt: new Date(), updatedAt: new Date() },
        { id: 'p4', userId: 'user-1', jobId: 'job-1', processType: ProcessType.Letter, status: ProcessStatus.Done, createdAt: new Date(), updatedAt: new Date() },
        { id: 'p5', userId: 'user-1', jobId: 'job-1', processType: ProcessType.Message, status: ProcessStatus.Done, createdAt: new Date(), updatedAt: new Date() },
      ],
    };

    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(completedJob as any);

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-1/analyze');
    const res = await POST(req, { params: Promise.resolve({ id: 'job-1' }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('done');
    expect(vi.mocked(runWorkflow)).not.toHaveBeenCalled();
  });

  it('returns 202 with status started and calls runWorkflow when job not in progress', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const jobWithoutProcesses = {
      id: 'job-2',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'New Job',
      content: 'Job description text',
      createdAt: new Date(),
      updatedAt: new Date(),
      resume: { id: 'resume-1', userId: 'user-1', name: 'Resume', content: 'Resume content', createdAt: new Date(), updatedAt: new Date() },
      processes: [],
    };

    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(jobWithoutProcesses as any);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-2/analyze');
    const res = await POST(req, { params: Promise.resolve({ id: 'job-2' }) } as any);

    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.status).toBe('started');
    expect(vi.mocked(runWorkflow)).toHaveBeenCalledWith({
      jobId: 'job-2',
      userId: 'user-1',
      resumeText: 'Resume content',
      jobText: 'Job description text',
    });
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ jobId: 'job-2', userId: 'user-1', processType: ProcessType.Company, status: ProcessStatus.Processing }),
        expect.objectContaining({ jobId: 'job-2', userId: 'user-1', processType: ProcessType.JDMatch, status: ProcessStatus.Processing }),
        expect.objectContaining({ jobId: 'job-2', userId: 'user-1', processType: ProcessType.ResumeFeedback, status: ProcessStatus.Processing }),
        expect.objectContaining({ jobId: 'job-2', userId: 'user-1', processType: ProcessType.Letter, status: ProcessStatus.Pending }),
        expect.objectContaining({ jobId: 'job-2', userId: 'user-1', processType: ProcessType.Message, status: ProcessStatus.Pending }),
      ])
    );
  });

  it('does not call runWorkflow when job is already in progress', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const jobInProgress = {
      id: 'job-3',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'In Progress Job',
      content: 'Job description',
      createdAt: new Date(),
      updatedAt: new Date(),
      resume: { id: 'resume-1', userId: 'user-1', name: 'Resume', content: 'Resume', createdAt: new Date(), updatedAt: new Date() },
      processes: [
        { id: 'p1', userId: 'user-1', jobId: 'job-3', processType: ProcessType.Company, status: ProcessStatus.Processing, createdAt: new Date(), updatedAt: new Date() },
        { id: 'p2', userId: 'user-1', jobId: 'job-3', processType: ProcessType.JDMatch, status: ProcessStatus.Pending, createdAt: new Date(), updatedAt: new Date() },
      ],
    };

    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(jobInProgress as any);

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-3/analyze');
    const res = await POST(req, { params: Promise.resolve({ id: 'job-3' }) } as any);

    expect(res.status).toBe(202);
    expect(vi.mocked(runWorkflow)).not.toHaveBeenCalled();
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });

  it('uses empty resume content when resume is null', async () => {
    const fakeSession = { user: { id: 'user-1' } };
    vi.mocked(auth.api.getSession).mockResolvedValue(fakeSession as any);

    const jobWithoutResume = {
      id: 'job-4',
      userId: 'user-1',
      resumeId: 'resume-1',
      name: 'Job Without Resume',
      content: 'Job description',
      createdAt: new Date(),
      updatedAt: new Date(),
      resume: null,
      processes: [],
    };

    vi.mocked(db.query.resumeJob.findFirst).mockResolvedValue(jobWithoutResume as any);

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    vi.mocked(db.insert).mockImplementation(mockInsert);

    const req = makeRequest('POST', 'http://localhost/api/jobs/job-4/analyze');
    const res = await POST(req, { params: Promise.resolve({ id: 'job-4' }) } as any);

    expect(res.status).toBe(202);
    expect(vi.mocked(runWorkflow)).toHaveBeenCalledWith({
      jobId: 'job-4',
      userId: 'user-1',
      resumeText: '',
      jobText: 'Job description',
    });
  });
});
