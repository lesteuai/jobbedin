import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from '@/app/lib/hooks/use-chat';
import { ProcessType } from '@/app/lib/db/schema';

const showError = vi.fn();

vi.mock('@/app/lib/app-store', () => ({
  useAppStore: () => ({ showError }),
}));

// Builds a minimal Response-like object for fetch mocks.
function makeResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  showError.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useChat initial state', () => {
  it('starts with defaults', () => {
    const { result } = renderHook(() => useChat(null, 'Generate'));

    expect(result.current.mode).toBe(ProcessType.Message);
    expect(result.current.chats[ProcessType.Letter]).toEqual([]);
    expect(result.current.chats[ProcessType.Message]).toEqual([]);
    expect(result.current.chatsLoaded).toBe(false);
    expect(result.current.chatDraft).toBe('');
    expect(result.current.isAiTyping).toBe(false);
  });
});

describe('useChat load effect', () => {
  it('does not fetch when tab is not Generate', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useChat('job-1', 'Overview'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch when selectedJobId is null or undefined', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useChat(null, 'Generate'));
    renderHook(() => useChat(undefined, 'Generate'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches both histories in parallel on the Generate tab', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ conversation: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat('job-1', 'Generate'));

    await waitFor(() => expect(result.current.chatsLoaded).toBe(true));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(`/api/jobs/job-1/chat?mode=${ProcessType.Letter}`);
    expect(fetchMock).toHaveBeenCalledWith(`/api/jobs/job-1/chat?mode=${ProcessType.Message}`);
  });

  it('populates chats per mode from each response conversation field', async () => {
    const letterConversation = [{ role: 'user', text: 'hello letter' }];
    const messageConversation = [{ role: 'ai', text: 'hello message' }];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes(`mode=${ProcessType.Letter}`)) return Promise.resolve(makeResponse({ conversation: letterConversation }));
      return Promise.resolve(makeResponse({ conversation: messageConversation }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat('job-1', 'Generate'));

    await waitFor(() => expect(result.current.chatsLoaded).toBe(true));

    expect(result.current.chats[ProcessType.Letter]).toEqual(letterConversation);
    expect(result.current.chats[ProcessType.Message]).toEqual(messageConversation);
  });

  it('yields an empty array for a mode whose response has no conversation field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat('job-1', 'Generate'));

    await waitFor(() => expect(result.current.chatsLoaded).toBe(true));

    expect(result.current.chats[ProcessType.Letter]).toEqual([]);
    expect(result.current.chats[ProcessType.Message]).toEqual([]);
  });

  it('calls showError and keeps chatsLoaded false when either response is not ok', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes(`mode=${ProcessType.Letter}`)) return Promise.resolve(makeResponse({}, false));
      return Promise.resolve(makeResponse({ conversation: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat('job-1', 'Generate'));

    await waitFor(() => expect(showError).toHaveBeenCalledWith('Failed to load chat history. Please try again.'));

    expect(result.current.chatsLoaded).toBe(false);
    consoleErrorSpy.mockRestore();
  });
});

describe('useChat derived flags', () => {
  it('canSend reflects draft content', () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ conversation: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat(null, 'Overview'));

    expect(result.current.canSend).toBe(false);

    act(() => result.current.setChatDraft('   '));
    expect(result.current.canSend).toBe(false);

    act(() => result.current.setChatDraft('hello'));
    expect(result.current.canSend).toBe(true);
  });

  it('canClear reflects the current mode line count and follows a mode switch', () => {
    const { result } = renderHook(() => useChat(null, 'Overview'));

    act(() => {
      result.current.setChats((prev) => ({ ...prev, [ProcessType.Message]: [{ role: 'user', text: 'hi' }] }));
    });

    expect(result.current.mode).toBe(ProcessType.Message);
    expect(result.current.canClear).toBe(true);

    act(() => result.current.setMode(ProcessType.Letter));
    expect(result.current.canClear).toBe(false);
  });

  it('lines returns the current mode array and follows a mode switch', () => {
    const { result } = renderHook(() => useChat(null, 'Overview'));

    act(() => {
      result.current.setChats((prev) => ({ ...prev, [ProcessType.Letter]: [{ role: 'ai', text: 'letter line' }] }));
    });

    expect(result.current.lines).toEqual([]); // still in message mode

    act(() => result.current.setMode(ProcessType.Letter));
    expect(result.current.lines).toEqual([{ role: 'ai', text: 'letter line' }]);
  });
});

describe('useChat handleSend', () => {
  it('does nothing when canSend is false', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing when selectedJobId is null', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat(null, 'Overview'));

    act(() => result.current.setChatDraft('hello'));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends successfully: clears draft, appends optimistically, posts body, appends AI reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ reply: 'AI says hi' }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    act(() => result.current.setChatDraft('  hello there  '));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(result.current.chatDraft).toBe('');
    expect(result.current.lines).toEqual([
      { role: 'user', text: 'hello there' },
      { role: 'ai', text: 'AI says hi' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/job-1/chat', expect.objectContaining({ method: 'POST' }));
    const [, options] = fetchMock.mock.calls[0];
    const parsedBody = JSON.parse(options.body as string);
    expect(parsedBody).toEqual({ mode: ProcessType.Message, userMessage: 'hello there' });
  });

  it('restores draft and removes the optimistic line on a failed send with JSON error body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ error: 'server rejected it' }, false));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    act(() => result.current.setChatDraft('original text'));
    const priorLength = result.current.lines.length;

    await act(async () => {
      await result.current.handleSend();
    });

    expect(showError).toHaveBeenCalledWith('server rejected it');
    expect(result.current.chatDraft).toBe('original text');
    expect(result.current.lines.length).toBe(priorLength);
  });

  it('calls showError with a fallback message when the failed response body is not valid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('invalid json');
      },
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    act(() => result.current.setChatDraft('original text'));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(showError).toHaveBeenCalledWith('Failed to send message');
  });

  it('rolls back on a rejected fetch using the error message', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    act(() => result.current.setChatDraft('original text'));
    const priorLength = result.current.lines.length;

    await act(async () => {
      await result.current.handleSend();
    });

    expect(showError).toHaveBeenCalledWith('network down');
    expect(result.current.chatDraft).toBe('original text');
    expect(result.current.lines.length).toBe(priorLength);
  });

  it('sets isAiTyping true while in flight and false afterwards', async () => {
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    act(() => result.current.setChatDraft('hello'));

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.handleSend();
    });

    expect(result.current.isAiTyping).toBe(true);

    await act(async () => {
      resolveFetch(makeResponse({ reply: 'hi' }));
      await sendPromise;
    });

    expect(result.current.isAiTyping).toBe(false);
  });
});

describe('useChat handleClear', () => {
  it('does nothing when selectedJobId is null', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat(null, 'Overview'));

    await act(async () => {
      await result.current.handleClear();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('empties the current mode lines and draft, posting conversation: []', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    act(() => {
      result.current.setChats((prev) => ({ ...prev, [ProcessType.Message]: [{ role: 'user', text: 'hi' }] }));
      result.current.setChatDraft('some draft');
    });

    await act(async () => {
      await result.current.handleClear();
    });

    expect(result.current.lines).toEqual([]);
    expect(result.current.chatDraft).toBe('');

    const [, options] = fetchMock.mock.calls[0];
    const parsedBody = JSON.parse(options.body as string);
    expect(parsedBody).toEqual({ mode: ProcessType.Message, conversation: [] });
  });

  it('only clears the current mode, leaving the other mode intact', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    act(() => {
      result.current.setChats(() => ({
        [ProcessType.Message]: [{ role: 'user', text: 'message line' }],
        [ProcessType.Letter]: [{ role: 'user', text: 'letter line' }],
      }));
    });

    await act(async () => {
      await result.current.handleClear();
    });

    expect(result.current.chats[ProcessType.Message]).toEqual([]);
    expect(result.current.chats[ProcessType.Letter]).toEqual([{ role: 'user', text: 'letter line' }]);
  });

  it('swallows a rejected fetch without calling showError', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    await act(async () => {
      await result.current.handleClear();
    });

    expect(showError).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe('useChat typing dots', () => {
  it('cycles . -> .. -> ... -> . every 400ms while typing, then stops', async () => {
    vi.useFakeTimers();
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useChat('job-1', 'Overview'));

    act(() => result.current.setChatDraft('hello'));

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.handleSend();
    });

    expect(result.current.typingDots).toBe('.');

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.typingDots).toBe('..');

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.typingDots).toBe('...');

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.typingDots).toBe('.');

    resolveFetch(makeResponse({ reply: 'hi' }));
    await act(async () => {
      await sendPromise;
    });

    expect(result.current.isAiTyping).toBe(false);
    const dotsAfterStop = result.current.typingDots;

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.typingDots).toBe(dotsAfterStop);

    vi.useRealTimers();
  });
});
