import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '@/test/db-mock';
import { makeRequest } from '@/test/next-request';
import { ProcessType, ProcessStatus } from '@/app/lib/db/schema';

const dbMock = createDbMock();

vi.mock('@/app/lib/db', () => ({ db: dbMock }));
vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(() => Promise.resolve({ user: { id: 'user-1' } })),
    },
  },
}));

const runWorkflow = vi.fn();
vi.mock('@/app/lib/workflow', () => ({ runWorkflow }));

const ANALYZE_URL = 'http://localhost:3000/api/jobs/job-1/analyze';
const PARAMS = { params: Promise.resolve({ id: 'job-1' }) };

type ProcessFixture = { processType: ProcessType; status: ProcessStatus };

function makeProcess(processType: ProcessType, status: ProcessStatus): ProcessFixture {
  return { processType, status };
}

function makeFiveProcesses(status: ProcessStatus): ProcessFixture[] {
  return [
    makeProcess(ProcessType.Company, status),
    makeProcess(ProcessType.JDMatch, status),
    makeProcess(ProcessType.ResumeFeedback, status),
    makeProcess(ProcessType.Letter, status),
    makeProcess(ProcessType.Message, status),
  ];
}

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    userId: 'user-1',
    content: 'the job description',
    resume: { content: 'the resume content' },
    processes: makeFiveProcesses(ProcessStatus.Done),
    ...overrides,
  };
}

beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
  runWorkflow.mockClear();
});

describe('POST /api/jobs/[id]/analyze', () => {
  it('returns 404 and does not run the workflow when the job is not found', async () => {
    dbMock.query.resumeJob.queueResult(undefined);

    const { POST } = await import('./route');
    const response = await POST(makeRequest(ANALYZE_URL), PARAMS);

    expect(response.status).toBe(404);
    expect(runWorkflow).not.toHaveBeenCalled();
  });

  it('returns done and skips restart when all five processes are done', async () => {
    dbMock.query.resumeJob.queueResult(makeJob({ processes: makeFiveProcesses(ProcessStatus.Done) }));

    const { POST } = await import('./route');
    const response = await POST(makeRequest(ANALYZE_URL), PARAMS);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'done' });
    expect(runWorkflow).not.toHaveBeenCalled();
    expect(dbMock.calls.delete).toHaveLength(0);
    expect(dbMock.calls.insert).toHaveLength(0);
  });

  describe('already in progress', () => {
    it.each([ProcessStatus.Processing, ProcessStatus.Pending])(
      'returns started without restarting when a process is %s',
      async (status) => {
        const processes = makeFiveProcesses(ProcessStatus.Done);
        processes[0] = makeProcess(ProcessType.Company, status);
        dbMock.query.resumeJob.queueResult(makeJob({ processes }));

        const { POST } = await import('./route');
        const response = await POST(makeRequest(ANALYZE_URL), PARAMS);
        const body = await response.json();

        expect(response.status).toBe(202);
        expect(body).toEqual({ status: 'started' });
        expect(runWorkflow).not.toHaveBeenCalled();
        expect(dbMock.calls.delete).toHaveLength(0);
        expect(dbMock.calls.insert).toHaveLength(0);
      }
    );
  });

  describe('fresh start', () => {
    it.each([
      ['all five failed', makeFiveProcesses(ProcessStatus.Failed)],
      ['no processes yet', [] as ProcessFixture[]],
    ])('%s clears stale data, inserts 5 processes, and runs the workflow', async (_label, processes) => {
      dbMock.query.resumeJob.queueResult(makeJob({ processes }));

      const { POST } = await import('./route');
      const response = await POST(makeRequest(ANALYZE_URL), PARAMS);
      const body = await response.json();

      expect(dbMock.calls.delete).toHaveLength(6);

      expect(dbMock.calls.insert).toHaveLength(1);
      const insertedRows = dbMock.calls.insert[0].values[0] as Array<Record<string, unknown>>;
      expect(insertedRows).toHaveLength(5);

      const byType = Object.fromEntries(insertedRows.map((row) => [row.processType, row]));
      expect(byType[ProcessType.Company]).toMatchObject({ status: ProcessStatus.Processing, userId: 'user-1', jobId: 'job-1' });
      expect(byType[ProcessType.JDMatch]).toMatchObject({ status: ProcessStatus.Processing, userId: 'user-1', jobId: 'job-1' });
      expect(byType[ProcessType.ResumeFeedback]).toMatchObject({ status: ProcessStatus.Processing, userId: 'user-1', jobId: 'job-1' });
      expect(byType[ProcessType.Letter]).toMatchObject({ status: ProcessStatus.Pending, userId: 'user-1', jobId: 'job-1' });
      expect(byType[ProcessType.Message]).toMatchObject({ status: ProcessStatus.Pending, userId: 'user-1', jobId: 'job-1' });

      expect(runWorkflow).toHaveBeenCalledTimes(1);
      expect(runWorkflow).toHaveBeenCalledWith({
        jobId: 'job-1',
        userId: 'user-1',
        resumeText: 'the resume content',
        jobText: 'the job description',
      });

      expect(response.status).toBe(202);
      expect(body).toEqual({ status: 'started' });
    });
  });

  describe('null content fallback', () => {
    it('passes empty resumeText when resume is missing', async () => {
      dbMock.query.resumeJob.queueResult(makeJob({ processes: [], resume: null }));

      const { POST } = await import('./route');
      await POST(makeRequest(ANALYZE_URL), PARAMS);

      expect(runWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ resumeText: '', jobText: 'the job description' })
      );
    });

    it('passes empty resumeText when resume.content is null', async () => {
      dbMock.query.resumeJob.queueResult(makeJob({ processes: [], resume: { content: null } }));

      const { POST } = await import('./route');
      await POST(makeRequest(ANALYZE_URL), PARAMS);

      expect(runWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ resumeText: '', jobText: 'the job description' })
      );
    });

    it('passes empty jobText when job.content is null', async () => {
      dbMock.query.resumeJob.queueResult(makeJob({ processes: [], content: null }));

      const { POST } = await import('./route');
      await POST(makeRequest(ANALYZE_URL), PARAMS);

      expect(runWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ resumeText: 'the resume content', jobText: '' })
      );
    });
  });

  describe('mixed states', () => {
    it('restarts when 4 of 5 processes are done and 1 failed', async () => {
      const processes = makeFiveProcesses(ProcessStatus.Done);
      processes[4] = makeProcess(ProcessType.Message, ProcessStatus.Failed);
      dbMock.query.resumeJob.queueResult(makeJob({ processes }));

      const { POST } = await import('./route');
      const response = await POST(makeRequest(ANALYZE_URL), PARAMS);
      const body = await response.json();

      expect(body).toEqual({ status: 'started' });
      expect(response.status).toBe(202);
      expect(dbMock.calls.delete).toHaveLength(6);
      expect(dbMock.calls.insert).toHaveLength(1);
      expect(runWorkflow).toHaveBeenCalledTimes(1);
    });

    it('restarts when fewer than 5 processes are all done', async () => {
      const processes = [
        makeProcess(ProcessType.Company, ProcessStatus.Done),
        makeProcess(ProcessType.JDMatch, ProcessStatus.Done),
        makeProcess(ProcessType.ResumeFeedback, ProcessStatus.Done),
      ];
      dbMock.query.resumeJob.queueResult(makeJob({ processes }));

      const { POST } = await import('./route');
      const response = await POST(makeRequest(ANALYZE_URL), PARAMS);
      const body = await response.json();

      expect(body).toEqual({ status: 'started' });
      expect(response.status).toBe(202);
      expect(dbMock.calls.delete).toHaveLength(6);
      expect(dbMock.calls.insert).toHaveLength(1);
      expect(runWorkflow).toHaveBeenCalledTimes(1);
    });
  });
});
