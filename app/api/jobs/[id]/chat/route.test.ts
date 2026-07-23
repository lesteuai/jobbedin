import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '@/test/db-mock';
import { makeRequest, makeJsonRequest } from '@/test/next-request';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

const dbMock = createDbMock();

vi.mock('@/app/lib/db', () => ({ db: dbMock }));
vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(() => Promise.resolve({ user: { id: 'user-1' } })),
    },
  },
}));

const invokeMock = vi.fn();

vi.mock('@/app/lib/openrouter', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/openrouter')>('@/app/lib/openrouter');
  return {
    createWritingLlm: vi.fn(() => ({ invoke: invokeMock })),
    isOutOfCreditError: actual.isOutOfCreditError,
  };
});

const JOB_ID = 'job-1';
const CHAT_URL = `http://localhost:3000/api/jobs/${JOB_ID}/chat`;
const params = () => Promise.resolve({ id: JOB_ID });

// Row shape returned by the resumeJob select in the route.
const jobRow = { id: JOB_ID, userId: 'user-1', resumeId: 'resume-1', content: null as string | null };

beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
  invokeMock.mockReset();
});

describe('GET /api/jobs/[id]/chat', () => {
  it('400s when mode is missing', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest(CHAT_URL), { params: params() });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/letter|message/i);
  });

  it('400s when mode is invalid', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest(`${CHAT_URL}?mode=bogus`), { params: params() });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/letter|message/i);
  });

  it('404s when the job does not belong to the session user', async () => {
    dbMock.queueResult([]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(`${CHAT_URL}?mode=letter`), { params: params() });
    expect(response.status).toBe(404);
  });

  it('returns an empty conversation when no history row exists', async () => {
    dbMock.queueResult([jobRow]);
    dbMock.queueResult([]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(`${CHAT_URL}?mode=letter`), { params: params() });
    const body = await response.json();
    expect(body).toEqual({ conversation: [] });
  });

  it('returns the stored conversation when a history row exists', async () => {
    const conversation = [{ role: 'user', text: 'hi' }, { role: 'ai', text: 'hello' }];
    dbMock.queueResult([jobRow]);
    dbMock.queueResult([{ conversation }]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(`${CHAT_URL}?mode=letter`), { params: params() });
    const body = await response.json();
    expect(body).toEqual({ conversation });
  });

  it('mode=letter and mode=message hit different tables', async () => {
    dbMock.queueResult([jobRow]);
    dbMock.queueResult([]);

    const { GET } = await import('./route');
    await GET(makeRequest(`${CHAT_URL}?mode=letter`), { params: params() });
    const letterHistoryTable = dbMock.calls.select[1].from[0];

    dbMock.calls.select.length = 0;
    dbMock.queueResult([jobRow]);
    dbMock.queueResult([]);

    await GET(makeRequest(`${CHAT_URL}?mode=message`), { params: params() });
    const messageHistoryTable = dbMock.calls.select[1].from[0];

    expect(letterHistoryTable).not.toBe(messageHistoryTable);
  });
});

describe('POST /api/jobs/[id]/chat validation', () => {
  it('400s when mode is missing', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { userMessage: 'hi' }),
      { params: params() }
    );
    expect(response.status).toBe(400);
  });

  it('400s when mode is invalid', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { mode: 'bogus', userMessage: 'hi' }),
      { params: params() }
    );
    expect(response.status).toBe(400);
  });

  it('404s when the job does not belong to the session user', async () => {
    dbMock.queueResult([]);

    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', userMessage: 'hi' }),
      { params: params() }
    );
    expect(response.status).toBe(404);
  });

  it('400s when neither userMessage nor conversation is provided', async () => {
    dbMock.queueResult([jobRow]);

    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter' }),
      { params: params() }
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/must be provided/i);
  });

  it('400s when conversation is not an array', async () => {
    dbMock.queueResult([jobRow]);

    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', conversation: 'not-an-array' }),
      { params: params() }
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/array/i);
  });
});

describe('POST /api/jobs/[id]/chat clear path', () => {
  it('deletes then inserts the supplied conversation', async () => {
    dbMock.queueResult([jobRow]);
    dbMock.queueResult(undefined); // delete
    dbMock.queueResult(undefined); // insert

    const conversation = [{ role: 'user', text: 'reset please' }];

    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', conversation }),
      { params: params() }
    );
    const body = await response.json();

    expect(body).toEqual({ success: true });
    expect(dbMock.calls.delete).toHaveLength(1);
    expect(dbMock.calls.insert).toHaveLength(1);
    expect(dbMock.calls.insert[0].values[0]).toEqual({
      jobId: JOB_ID,
      userId: 'user-1',
      conversation,
    });
  });
});

describe('POST /api/jobs/[id]/chat AI path', () => {
  // Queues the four sequential/parallel selects the AI path performs after the job lookup:
  // existing history, company, jdMatch, resume, userSettings.
  function queueAiPathSelects(options: {
    job?: typeof jobRow;
    history?: unknown[];
    company?: unknown[];
    jdMatch?: unknown[];
    resume?: unknown[];
    userSettings?: unknown[];
  } = {}) {
    dbMock.queueResult([options.job ?? jobRow]);
    dbMock.queueResult(options.history ?? []);
    dbMock.queueResult(options.company ?? []);
    dbMock.queueResult(options.jdMatch ?? []);
    dbMock.queueResult(options.resume ?? []);
    dbMock.queueResult(options.userSettings ?? []);
  }

  it('converts prior history to LangChain messages and appends the new HumanMessage', async () => {
    const history = [
      { role: 'user', text: 'first question' },
      { role: 'ai', text: 'first answer' },
    ];
    queueAiPathSelects({ history: [{ conversation: history }] });
    dbMock.queueResult(undefined); // delete
    dbMock.queueResult(undefined); // insert
    invokeMock.mockResolvedValue({ content: 'the reply' });

    const { POST } = await import('./route');
    await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', userMessage: 'second question' }),
      { params: params() }
    );

    const messages = invokeMock.mock.calls[0][0] as unknown[];
    expect(messages).toHaveLength(4);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    expect((messages[1] as HumanMessage).content).toBe('first question');
    expect(messages[2]).toBeInstanceOf(AIMessage);
    expect((messages[2] as AIMessage).content).toBe('first answer');
    expect(messages[3]).toBeInstanceOf(HumanMessage);
    expect((messages[3] as HumanMessage).content).toBe('second question');
  });

  it('includes JD match, company, resume, and job description context sections when present', async () => {
    queueAiPathSelects({
      job: { ...jobRow, content: 'job description text' },
      company: [{ content: 'company info text' }],
      jdMatch: [{ content: 'jd match text' }],
      resume: [{ content: 'resume text' }],
    });
    dbMock.queueResult(undefined);
    dbMock.queueResult(undefined);
    invokeMock.mockResolvedValue({ content: 'reply' });

    const { POST } = await import('./route');
    await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', userMessage: 'hi' }),
      { params: params() }
    );

    const systemMessage = (invokeMock.mock.calls[0][0] as [SystemMessage])[0];
    const promptText = systemMessage.content as string;
    expect(promptText).toContain('JD Match info: jd match text');
    expect(promptText).toContain('Company info: company info text');
    expect(promptText).toContain('Resume: resume text');
    expect(promptText).toContain('Job Description: job description text');
  });

  it('omits all context sections when company, jdMatch, resume, and job content are absent', async () => {
    queueAiPathSelects();
    dbMock.queueResult(undefined);
    dbMock.queueResult(undefined);
    invokeMock.mockResolvedValue({ content: 'reply' });

    const { POST } = await import('./route');
    await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', userMessage: 'hi' }),
      { params: params() }
    );

    const { generate_letter_prompt } = await import('@/app/lib/system-prompt');
    const systemMessage = (invokeMock.mock.calls[0][0] as [SystemMessage])[0];
    expect(systemMessage.content).toBe(generate_letter_prompt(undefined));
  });

  it('persists the reply and returns it, appending user and AI lines to prior history', async () => {
    const history = [{ role: 'user', text: 'earlier' }, { role: 'ai', text: 'reply' }];
    queueAiPathSelects({ history: [{ conversation: history }] });
    dbMock.queueResult(undefined);
    dbMock.queueResult(undefined);
    invokeMock.mockResolvedValue({ content: 'new reply' });

    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', userMessage: 'new question' }),
      { params: params() }
    );
    const body = await response.json();

    expect(body).toEqual({ reply: 'new reply' });
    expect(dbMock.calls.insert[0].values[0]).toEqual({
      jobId: JOB_ID,
      userId: 'user-1',
      conversation: [
        ...history,
        { role: 'user', text: 'new question' },
        { role: 'ai', text: 'new reply' },
      ],
    });
  });

  it('uses the letter prompt for mode=letter and the message prompt for mode=message', async () => {
    queueAiPathSelects();
    dbMock.queueResult(undefined);
    dbMock.queueResult(undefined);
    invokeMock.mockResolvedValue({ content: 'reply' });

    const { POST } = await import('./route');
    await POST(makeJsonRequest(CHAT_URL, { mode: 'letter', userMessage: 'hi' }), { params: params() });
    const letterPrompt = (invokeMock.mock.calls[0][0] as [SystemMessage])[0].content;

    invokeMock.mockClear();
    queueAiPathSelects();
    dbMock.queueResult(undefined);
    dbMock.queueResult(undefined);
    invokeMock.mockResolvedValue({ content: 'reply' });

    await POST(makeJsonRequest(CHAT_URL, { mode: 'message', userMessage: 'hi' }), { params: params() });
    const messagePrompt = (invokeMock.mock.calls[0][0] as [SystemMessage])[0].content;

    expect(letterPrompt).not.toBe(messagePrompt);
  });

  it('stringifies non-string LLM content', async () => {
    queueAiPathSelects();
    dbMock.queueResult(undefined);
    dbMock.queueResult(undefined);
    invokeMock.mockResolvedValue({ content: { not: 'a string' } });

    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', userMessage: 'hi' }),
      { params: params() }
    );
    const body = await response.json();

    expect(body.reply).toBe(String({ not: 'a string' }));
  });
});

describe('POST /api/jobs/[id]/chat error mapping', () => {
  it('maps an out-of-credit APIError to a 402 mentioning OpenRouter credit', async () => {
    dbMock.queueResult([jobRow]);
    dbMock.queueResult([]);
    dbMock.queueResult([]);
    dbMock.queueResult([]);
    dbMock.queueResult([]);
    dbMock.queueResult([]);

    class APIError extends Error {
      status = 402;
    }
    invokeMock.mockRejectedValue(new APIError('out of credit'));

    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', userMessage: 'hi' }),
      { params: params() }
    );
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.error).toMatch(/openrouter/i);
    expect(body.error).toMatch(/credit/i);
  });

  it('propagates other errors to the 500 handler', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    dbMock.queueResult([jobRow]);
    dbMock.queueResult([]);
    dbMock.queueResult([]);
    dbMock.queueResult([]);
    dbMock.queueResult([]);
    dbMock.queueResult([]);

    invokeMock.mockRejectedValue(new Error('boom'));

    const { POST } = await import('./route');
    const response = await POST(
      makeJsonRequest(CHAT_URL, { mode: 'letter', userMessage: 'hi' }),
      { params: params() }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });

    consoleErrorSpy.mockRestore();
  });
});
