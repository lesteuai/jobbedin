import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const STREAM_URL = 'http://localhost:3000/api/jobs/job-1/analysis-stream';
const PARAMS = { params: Promise.resolve({ id: 'job-1' }) };

function makeFiveProcesses(status: ProcessStatus) {
  return [
    { processType: ProcessType.Company, status },
    { processType: ProcessType.JDMatch, status },
    { processType: ProcessType.ResumeFeedback, status },
    { processType: ProcessType.Letter, status },
    { processType: ProcessType.Message, status },
  ];
}

// Reads the next chunk from the stream reader and parses the SSE `data: <json>\n\n` payload.
// The route enqueues plain strings (no TextEncoder), so no decoding is needed.
async function readChunk(reader: ReadableStreamDefaultReader<string>) {
  const { value, done } = await reader.read();
  if (done || !value) return { done, data: undefined };
  expect(value).toMatch(/^data: .*\n\n$/);
  const data = JSON.parse(value.slice('data: '.length, -2));
  return { done, data };
}

beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/jobs/[id]/analysis-stream', () => {
  it('returns 400 when id is empty', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest(STREAM_URL), { params: Promise.resolve({ id: '' }) });

    expect(response.status).toBe(400);
  });

  it('sets the SSE response headers', async () => {
    dbMock.query.resumeJob.queueResult(undefined);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(STREAM_URL), PARAMS);

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');

    await response.body?.getReader().read();
  });

  it('delivers the first poll immediately with the documented data shape', async () => {
    dbMock.query.resumeJob.queueResult({
      id: 'job-1',
      company: { content: 'company research' },
      jobDescriptionMatch: undefined,
      resumeFeedback: undefined,
      coverLetterHistory: undefined,
      messageGenHistory: undefined,
      processes: makeFiveProcesses(ProcessStatus.Processing),
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest(STREAM_URL), PARAMS);
    const reader = response.body!.getReader();
    const { data } = await readChunk(reader);

    expect(data).toEqual({
      company: 'company research',
      jdMatch: null,
      feedback: null,
      letterConversation: null,
      messageConversation: null,
      processes: makeFiveProcesses(ProcessStatus.Processing).map((p) => ({
        processType: p.processType,
        status: p.status,
        statusReason: null,
      })),
    });

    await reader.cancel();
  });

  it('enqueues a job-not-found error and closes the stream', async () => {
    dbMock.query.resumeJob.queueResult(undefined);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(STREAM_URL), PARAMS);
    const reader = response.body!.getReader();
    const { data } = await readChunk(reader);

    expect(data).toEqual({ error: 'Job not found' });

    const next = await reader.read();
    expect(next.done).toBe(true);
  });

  it('closes the stream after the first chunk when all five processes are terminal', async () => {
    dbMock.query.resumeJob.queueResult({
      id: 'job-1',
      company: undefined,
      jobDescriptionMatch: undefined,
      resumeFeedback: undefined,
      coverLetterHistory: undefined,
      messageGenHistory: undefined,
      processes: [
        { processType: ProcessType.Company, status: ProcessStatus.Done },
        { processType: ProcessType.JDMatch, status: ProcessStatus.Done },
        { processType: ProcessType.ResumeFeedback, status: ProcessStatus.Failed },
        { processType: ProcessType.Letter, status: ProcessStatus.Done },
        { processType: ProcessType.Message, status: ProcessStatus.Failed },
      ],
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest(STREAM_URL), PARAMS);
    const reader = response.body!.getReader();

    await readChunk(reader);
    const next = await reader.read();
    expect(next.done).toBe(true);
  });

  it('stays open and delivers a second chunk on the next poll when processes are still in progress', async () => {
    vi.useFakeTimers();

    dbMock.query.resumeJob.queueResult({
      id: 'job-1',
      company: undefined,
      jobDescriptionMatch: undefined,
      resumeFeedback: undefined,
      coverLetterHistory: undefined,
      messageGenHistory: undefined,
      processes: makeFiveProcesses(ProcessStatus.Processing),
    });
    dbMock.query.resumeJob.queueResult({
      id: 'job-1',
      company: undefined,
      jobDescriptionMatch: undefined,
      resumeFeedback: undefined,
      coverLetterHistory: undefined,
      messageGenHistory: undefined,
      processes: makeFiveProcesses(ProcessStatus.Done),
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest(STREAM_URL), PARAMS);
    const reader = response.body!.getReader();

    const first = await readChunk(reader);
    expect(first.data.processes[0].status).toBe(ProcessStatus.Processing);

    const secondPromise = readChunk(reader);
    await vi.advanceTimersByTimeAsync(1000);
    const second = await secondPromise;

    expect(second.data.processes[0].status).toBe(ProcessStatus.Done);

    await reader.cancel();
  });

  it('enqueues an error chunk carrying the message and closes the stream on a database error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    dbMock.query.resumeJob.findFirst.mockImplementationOnce(() => {
      throw new Error('connection lost');
    });

    const { GET } = await import('./route');
    const response = await GET(makeRequest(STREAM_URL), PARAMS);
    const reader = response.body!.getReader();
    const { data } = await readChunk(reader);

    expect(data).toEqual({ error: 'connection lost' });

    const next = await reader.read();
    expect(next.done).toBe(true);

    consoleErrorSpy.mockRestore();
  });
});
