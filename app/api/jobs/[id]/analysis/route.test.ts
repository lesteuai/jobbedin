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

const ANALYSIS_URL = 'http://localhost:3000/api/jobs/job-1/analysis';
const PARAMS = { params: Promise.resolve({ id: 'job-1' }) };

beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
});

describe('GET /api/jobs/[id]/analysis', () => {
  it('returns 400 when id is empty', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest(ANALYSIS_URL), { params: Promise.resolve({ id: '' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 when the job is not found', async () => {
    dbMock.query.resumeJob.queueResult(undefined);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(ANALYSIS_URL), PARAMS);

    expect(response.status).toBe(404);
  });

  it('returns null for every relation when absent', async () => {
    dbMock.query.resumeJob.queueResult({
      id: 'job-1',
      company: undefined,
      jobDescriptionMatch: undefined,
      resumeFeedback: undefined,
      coverLetterHistory: undefined,
      messageGenHistory: undefined,
      processes: [],
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest(ANALYSIS_URL), PARAMS);
    const body = await response.json();

    expect(body).toEqual({
      company: null,
      jdMatch: null,
      feedback: null,
      letterConversation: null,
      messageConversation: null,
      processes: [],
    });
  });

  it('returns each relation content when present, and maps processes to processType/status only', async () => {
    dbMock.query.resumeJob.queueResult({
      id: 'job-1',
      company: { content: 'company research' },
      jobDescriptionMatch: { content: 'jd match content' },
      resumeFeedback: { content: 'feedback content' },
      coverLetterHistory: { conversation: [{ role: 'user', content: 'hi' }] },
      messageGenHistory: { conversation: [{ role: 'assistant', content: 'hello' }] },
      processes: [
        { processType: ProcessType.Company, status: ProcessStatus.Done, statusReason: 'out_of_credit' },
        { processType: ProcessType.JDMatch, status: ProcessStatus.Processing, statusReason: null },
      ],
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest(ANALYSIS_URL), PARAMS);
    const body = await response.json();

    expect(body).toEqual({
      company: 'company research',
      jdMatch: 'jd match content',
      feedback: 'feedback content',
      letterConversation: [{ role: 'user', content: 'hi' }],
      messageConversation: [{ role: 'assistant', content: 'hello' }],
      processes: [
        { processType: ProcessType.Company, status: ProcessStatus.Done },
        { processType: ProcessType.JDMatch, status: ProcessStatus.Processing },
      ],
    });
    // statusReason is not part of this endpoint's documented process shape
    expect(body.processes[0]).not.toHaveProperty('statusReason');
  });
});
