import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { createDbMock } from '@/test/db-mock';
import { makeRequest } from '@/test/next-request';

const dbMock = createDbMock();

let pdfGetTextMock = vi.fn(() => Promise.resolve({ text: 'pdf extracted text' }));

vi.mock('@/app/lib/db', () => ({ db: dbMock }));
vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(() => Promise.resolve({ user: { id: 'user-1' } })),
    },
  },
}));
vi.mock('pdf-parse/worker', () => ({}));
vi.mock('pdf-parse', () => ({
  PDFParse: class {
    getText() {
      return pdfGetTextMock();
    }
  },
}));

const RESUMES_URL = 'http://localhost:3000/api/resumes';

function makeUploadRequest(filename: string, content: string, type = 'text/plain'): NextRequest {
  const formData = new FormData();
  const file = new File([content], filename, { type });
  formData.append('file', file);
  return new Request(RESUMES_URL, { method: 'POST', body: formData }) as unknown as NextRequest;
}

function getInsertValues(): Record<string, unknown> {
  const call = dbMock.calls.insert.at(-1);
  return (call?.values[0] as Record<string, unknown>) ?? {};
}

beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
  pdfGetTextMock = vi.fn(() => Promise.resolve({ text: 'pdf extracted text' }));
});

describe('GET /api/resumes', () => {
  it('returns the session-scoped list ordered by creation date', async () => {
    const rows = [{ id: 'r1', name: 'Resume', createdAt: 'now', updatedAt: 'now' }];
    dbMock.queueResult(rows);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(RESUMES_URL));
    const body = await response.json();

    expect(body).toEqual(rows);
    const selectCall = dbMock.calls.select.at(-1);
    expect(selectCall?.orderBy[0]).toBeDefined();
    expect(selectCall?.where[0]).toBeDefined();
  });
});

describe('POST /api/resumes', () => {
  it('returns 400 "No file provided" when no file is in the form data', async () => {
    const formData = new FormData();
    const request = new Request(RESUMES_URL, { method: 'POST', body: formData }) as unknown as NextRequest;

    const { POST } = await import('./route');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('No file provided');
  });

  it('stores decoded text and strips the extension from a .txt upload', async () => {
    dbMock.queueResult(undefined);

    const { POST } = await import('./route');
    const response = await POST(makeUploadRequest('resume.txt', 'hello world'));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(getInsertValues().name).toBe('resume');
    expect(getInsertValues().content).toBe('hello world');
  });

  it('behaves the same for a .md upload', async () => {
    dbMock.queueResult(undefined);

    const { POST } = await import('./route');
    const response = await POST(makeUploadRequest('resume.md', '# hello'));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(getInsertValues().name).toBe('resume');
    expect(getInsertValues().content).toBe('# hello');
  });

  it('accepts an uppercase extension case-insensitively', async () => {
    dbMock.queueResult(undefined);

    const { POST } = await import('./route');
    const response = await POST(makeUploadRequest('RESUME.TXT', 'hello'));

    expect(response.status).toBe(201);
    expect(getInsertValues().name).toBe('RESUME');
  });

  it('calls the PDF parser and stores the extracted text for a .pdf upload', async () => {
    dbMock.queueResult(undefined);

    const { POST } = await import('./route');
    const response = await POST(makeUploadRequest('resume.pdf', 'binary-ish content', 'application/pdf'));

    expect(response.status).toBe(201);
    expect(pdfGetTextMock).toHaveBeenCalled();
    expect(getInsertValues().content).toBe('pdf extracted text');
    expect(getInsertValues().name).toBe('resume');
  });

  it('returns 400 "Failed to parse PDF" when getText rejects', async () => {
    pdfGetTextMock = vi.fn(() => Promise.reject(new Error('boom')));
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { POST } = await import('./route');
    const response = await POST(makeUploadRequest('resume.pdf', 'content', 'application/pdf'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Failed to parse PDF');
    consoleSpy.mockRestore();
  });

  it('returns 400 "Unsupported file type" for an unsupported extension', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeUploadRequest('resume.docx', 'content'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Unsupported file type');
  });

  it('returns 400 "Unsupported file type" for a filename with no extension', async () => {
    const { POST } = await import('./route');
    const response = await POST(makeUploadRequest('resume', 'content'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Unsupported file type');
  });

  it('carries the session user id on the inserted row', async () => {
    dbMock.queueResult(undefined);

    const { POST } = await import('./route');
    await POST(makeUploadRequest('resume.txt', 'hello'));

    expect(getInsertValues().userId).toBe('user-1');
  });
});
