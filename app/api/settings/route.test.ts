import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '@/test/db-mock';
import { makeRequest, makeJsonRequest } from '@/test/next-request';
import { decrypt } from '@/app/lib/crypto';

const dbMock = createDbMock();

vi.mock('@/app/lib/db', () => ({ db: dbMock }));
vi.mock('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(() => Promise.resolve({ user: { id: 'user-1' } })),
    },
  },
}));

const SETTINGS_URL = 'http://localhost:3000/api/settings';

// Extracts the `set` object passed to the recorded insert call's onConflictDoUpdate.
function getUpdateSet(): Record<string, unknown> {
  const call = dbMock.calls.insert.at(-1);
  const args = call?.onConflictDoUpdate[0] as { set: Record<string, unknown> } | undefined;
  return args?.set ?? {};
}

function getInsertValues(): Record<string, unknown> {
  const call = dbMock.calls.insert.at(-1);
  return (call?.values[0] as Record<string, unknown>) ?? {};
}

beforeEach(() => {
  dbMock.calls.select.length = 0;
  dbMock.calls.insert.length = 0;
  dbMock.calls.delete.length = 0;
});

describe('GET /api/settings', () => {
  it('returns stored row values with hasOpenrouterApiKey true', async () => {
    dbMock.queueResult([
      {
        customLetterInstructions: 'letter instructions',
        customMsgInstructions: 'msg instructions',
        hasOpenrouterApiKey: true,
      },
    ]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(SETTINGS_URL));
    const body = await response.json();

    expect(body).toEqual({
      customLetterInstructions: 'letter instructions',
      customMsgInstructions: 'msg instructions',
      hasOpenrouterApiKey: true,
    });
  });

  it('returns empty defaults and hasOpenrouterApiKey false when no row exists', async () => {
    dbMock.queueResult([]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(SETTINGS_URL));
    const body = await response.json();

    expect(body).toEqual({
      customLetterInstructions: '',
      customMsgInstructions: '',
      hasOpenrouterApiKey: false,
    });
  });

  it('never exposes a raw key field, only the documented three keys', async () => {
    dbMock.queueResult([
      {
        customLetterInstructions: 'x',
        customMsgInstructions: 'y',
        hasOpenrouterApiKey: true,
      },
    ]);

    const { GET } = await import('./route');
    const response = await GET(makeRequest(SETTINGS_URL));
    const body = await response.json();

    expect(Object.keys(body).sort()).toEqual(
      ['customLetterInstructions', 'customMsgInstructions', 'hasOpenrouterApiKey'].sort()
    );
    expect(body).not.toHaveProperty('openrouterApiKey');
  });
});

describe('PUT /api/settings partial-update matrix', () => {
  it('instructions only: set contains both instruction keys, not openrouterApiKey', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    const response = await PUT(
      makeJsonRequest(SETTINGS_URL, {
        customLetterInstructions: 'letter',
        customMsgInstructions: 'msg',
      }, { method: 'PUT' })
    );

    expect(response.status).toBe(200);
    const set = getUpdateSet();
    expect(set).toEqual({
      customLetterInstructions: 'letter',
      customMsgInstructions: 'msg',
    });
    expect(set).not.toHaveProperty('openrouterApiKey');
  });

  it('api key only: set contains openrouterApiKey, not either instruction key', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    const response = await PUT(
      makeJsonRequest(SETTINGS_URL, { openrouterApiKey: 'sk-or-test-key' }, { method: 'PUT' })
    );

    expect(response.status).toBe(200);
    const set = getUpdateSet();
    expect(set).toHaveProperty('openrouterApiKey');
    expect(set).not.toHaveProperty('customLetterInstructions');
    expect(set).not.toHaveProperty('customMsgInstructions');
  });

  it('clearOpenrouterApiKey true with no key supplied: set.openrouterApiKey is null', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    await PUT(
      makeJsonRequest(SETTINGS_URL, { clearOpenrouterApiKey: true }, { method: 'PUT' })
    );

    const set = getUpdateSet();
    expect(set.openrouterApiKey).toBeNull();
  });

  it('non-empty key with clearOpenrouterApiKey true: key wins, not null', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    await PUT(
      makeJsonRequest(
        SETTINGS_URL,
        { openrouterApiKey: 'sk-or-test-key', clearOpenrouterApiKey: true },
        { method: 'PUT' }
      )
    );

    const set = getUpdateSet();
    expect(set.openrouterApiKey).not.toBeNull();
    expect(typeof set.openrouterApiKey).toBe('string');
  });

  it('whitespace-only key counts as absent; combined with clear, clears to null', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    await PUT(
      makeJsonRequest(
        SETTINGS_URL,
        { openrouterApiKey: '   ', clearOpenrouterApiKey: true },
        { method: 'PUT' }
      )
    );

    const set = getUpdateSet();
    expect(set.openrouterApiKey).toBeNull();
  });

  it('whitespace-only key without clear: does not appear in set at all', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    await PUT(
      makeJsonRequest(SETTINGS_URL, { openrouterApiKey: '   ' }, { method: 'PUT' })
    );

    const set = getUpdateSet();
    expect(set).not.toHaveProperty('openrouterApiKey');
  });

  it('empty body: no database write happens, response is still success', async () => {
    const { PUT } = await import('./route');
    const response = await PUT(makeJsonRequest(SETTINGS_URL, {}, { method: 'PUT' }));
    const body = await response.json();

    expect(dbMock.calls.insert).toHaveLength(0);
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it('non-string customLetterInstructions (number) is treated as absent', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    await PUT(
      makeJsonRequest(
        SETTINGS_URL,
        { customLetterInstructions: 42, customMsgInstructions: 'msg' },
        { method: 'PUT' }
      )
    );

    const set = getUpdateSet();
    expect(set).not.toHaveProperty('customLetterInstructions');
    expect(set).toEqual({ customMsgInstructions: 'msg' });
  });

  it('non-string customLetterInstructions (null) is treated as absent', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    await PUT(
      makeJsonRequest(
        SETTINGS_URL,
        { customLetterInstructions: null, customMsgInstructions: 'msg' },
        { method: 'PUT' }
      )
    );

    const set = getUpdateSet();
    expect(set).not.toHaveProperty('customLetterInstructions');
  });
});

describe('PUT /api/settings encryption round-trip', () => {
  it('stores ciphertext, not plaintext, and decrypts back to the trimmed input', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    await PUT(
      makeJsonRequest(SETTINGS_URL, { openrouterApiKey: '  sk-or-test-key  ' }, { method: 'PUT' })
    );

    const set = getUpdateSet();
    const storedValue = set.openrouterApiKey as string;

    expect(storedValue).not.toBe('sk-or-test-key');
    expect(storedValue).not.toContain('sk-or-test-key');
    expect(decrypt(storedValue)).toBe('sk-or-test-key');
  });
});

describe('PUT /api/settings insert values', () => {
  it('sets userId from the session and includes openrouterApiKey only when supplied', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    await PUT(
      makeJsonRequest(SETTINGS_URL, { customLetterInstructions: 'letter' }, { method: 'PUT' })
    );

    const insertValues = getInsertValues();
    expect(insertValues.userId).toBe('user-1');
    expect(insertValues).not.toHaveProperty('openrouterApiKey');
  });

  it('includes openrouterApiKey in insert values when a key is supplied', async () => {
    dbMock.queueResult(undefined);

    const { PUT } = await import('./route');
    await PUT(
      makeJsonRequest(SETTINGS_URL, { openrouterApiKey: 'sk-or-test-key' }, { method: 'PUT' })
    );

    const insertValues = getInsertValues();
    expect(insertValues.userId).toBe('user-1');
    expect(insertValues).toHaveProperty('openrouterApiKey');
  });
});
