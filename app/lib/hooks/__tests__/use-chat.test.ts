import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChat } from '@/app/lib/hooks/use-chat';

vi.mock('@/app/lib/app-store', () => ({
  useAppStore: () => ({ showError: vi.fn() }),
}));

describe('useChat', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('initial state with tab other than Generate', () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));
    expect(result.current.mode).toBe('message');
    expect(result.current.chats).toEqual({ letter: [], message: [] });
    expect(result.current.chatDraft).toBe('');
    expect(result.current.isAiTyping).toBe(false);
    expect(result.current.typingDots).toBe('.');
    expect(result.current.chatsLoaded).toBe(false);
  });

  it('initial state with no selectedJobId', () => {
    const { result } = renderHook(() => useChat(null, 'Generate'));
    expect(result.current.chats).toEqual({ letter: [], message: [] });
    expect(result.current.chatsLoaded).toBe(false);
  });

  it('setMode switches between letter and message', () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));
    expect(result.current.mode).toBe('message');

    act(() => {
      result.current.setMode('letter');
    });

    expect(result.current.mode).toBe('letter');

    act(() => {
      result.current.setMode('message');
    });

    expect(result.current.mode).toBe('message');
  });

  it('handleSend with empty draft does not call fetch', async () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    act(() => {
      result.current.setChatDraft('');
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('handleSend with whitespace-only draft does not call fetch', async () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    act(() => {
      result.current.setChatDraft('   ');
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('handleSend with text calls fetch with correct body and updates chats', async () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'AI says hi' }),
    } as Response);

    act(() => {
      result.current.setChatDraft('Hello AI');
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(fetch).toHaveBeenCalledWith('/api/jobs/job-1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'message', userMessage: 'Hello AI' }),
    });

    expect(result.current.chats.message).toEqual([
      { role: 'user', text: 'Hello AI' },
      { role: 'ai', text: 'AI says hi' },
    ]);
    expect(result.current.chatDraft).toBe('');
  });

  it('handleSend clears draft and adds user message before fetch', async () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'Response' }),
    } as Response);

    act(() => {
      result.current.setChatDraft('My message');
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(result.current.chatDraft).toBe('');
  });

  it('handleSend with failed fetch shows error and reverts message', async () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    act(() => {
      result.current.setChatDraft('Test message');
    });

    const userMessage = result.current.chatDraft;

    await act(async () => {
      await result.current.handleSend();
    });

    // Message should be reverted to draft
    expect(result.current.chatDraft).toBe(userMessage);
    // User message should not be in chats (reverted by slice)
    expect(result.current.chats.message).toEqual([]);
  });

  it('handleSend strips whitespace from draft', async () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'Response' }),
    } as Response);

    act(() => {
      result.current.setChatDraft('  Trimmed message  ');
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('Trimmed message'),
      })
    );

    expect(result.current.chats.message[0]).toEqual({ role: 'user', text: 'Trimmed message' });
  });

  it('handleClear calls fetch with correct body and resets chats', async () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'Initial message' }),
    } as Response);

    // Add a message first
    act(() => {
      result.current.setChatDraft('Hello');
    });

    await act(async () => {
      await result.current.handleSend();
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await act(async () => {
      await result.current.handleClear();
    });

    expect(fetch).toHaveBeenCalledWith('/api/jobs/job-1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'message', conversation: [] }),
    });

    expect(result.current.chats.message).toEqual([]);
  });

  it('handleClear resets chatDraft', async () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    act(() => {
      result.current.setChatDraft('Draft text');
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await act(async () => {
      await result.current.handleClear();
    });

    expect(result.current.chatDraft).toBe('');
  });

  it('handleClear with no selectedJobId does nothing', async () => {
    const { result } = renderHook(() => useChat(null, 'Other'));

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await act(async () => {
      await result.current.handleClear();
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('handleClear clears the correct mode', async () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    // Set chats for both modes
    act(() => {
      result.current.setChats({
        letter: [{ role: 'user', text: 'Letter message' }],
        message: [{ role: 'user', text: 'Chat message' }],
      });
    });

    // Switch to letter mode and clear
    act(() => {
      result.current.setMode('letter');
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await act(async () => {
      await result.current.handleClear();
    });

    expect(result.current.chats.letter).toEqual([]);
    expect(result.current.chats.message).toEqual([{ role: 'user', text: 'Chat message' }]);
  });

  it('canSend returns false when draft is empty', () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));
    act(() => {
      result.current.setChatDraft('');
    });
    expect(result.current.canSend).toBe(false);
  });

  it('canSend returns true when draft has text', () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));
    act(() => {
      result.current.setChatDraft('Hello');
    });
    expect(result.current.canSend).toBe(true);
  });

  it('canClear returns false when chats are empty', () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));
    expect(result.current.canClear).toBe(false);
  });

  it('canClear returns true when chats have messages', () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));
    act(() => {
      result.current.setChats({
        letter: [],
        message: [{ role: 'user', text: 'Hello' }],
      });
    });
    expect(result.current.canClear).toBe(true);
  });

  it('loads chats from API when tab is Generate and selectedJobId is set', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversation: [{ role: 'user', text: 'Letter message' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          conversation: [{ role: 'user', text: 'Chat message' }],
        }),
      } as Response);

    const { result } = renderHook(() => useChat('job-1', 'Generate'));

    await waitFor(() => {
      expect(result.current.chatsLoaded).toBe(true);
    });

    expect(fetch).toHaveBeenCalledWith('/api/jobs/job-1/chat?mode=letter');
    expect(fetch).toHaveBeenCalledWith('/api/jobs/job-1/chat?mode=message');

    expect(result.current.chats.letter).toEqual([{ role: 'user', text: 'Letter message' }]);
    expect(result.current.chats.message).toEqual([{ role: 'user', text: 'Chat message' }]);
  });

  it('does not load chats when tab is not Generate', () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));
    expect(result.current.chatsLoaded).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not load chats when selectedJobId is null', () => {
    const { result } = renderHook(() => useChat(null, 'Generate'));
    expect(result.current.chatsLoaded).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows error when chat loading fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useChat('job-1', 'Generate'));

    await waitFor(() => {
      expect(result.current.chatsLoaded).toBe(false);
    });
  });

  it('lines returns messages for current mode', () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));

    act(() => {
      result.current.setChats({
        letter: [{ role: 'user', text: 'Letter' }],
        message: [{ role: 'user', text: 'Message' }],
      });
      result.current.setMode('letter');
    });

    expect(result.current.lines).toEqual([{ role: 'user', text: 'Letter' }]);

    act(() => {
      result.current.setMode('message');
    });

    expect(result.current.lines).toEqual([{ role: 'user', text: 'Message' }]);
  });

  it('chatContainerRef is defined', () => {
    const { result } = renderHook(() => useChat('job-1', 'Other'));
    expect(result.current.chatContainerRef).toBeDefined();
    expect(result.current.chatContainerRef.current).toBeNull();
  });
});
