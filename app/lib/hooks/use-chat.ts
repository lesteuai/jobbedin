import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/app/lib/app-store';

export type Mode = 'letter' | 'message';
export type ChatLine = { role: 'user' | 'ai'; text: string };

export function useChat(selectedJobId: string | null | undefined, tab: string) {
  const { showError } = useAppStore();
  const [mode, setMode] = useState<Mode>('message');
  const [chats, setChats] = useState<Record<Mode, ChatLine[]>>({ letter: [], message: [] });
  const [chatDraft, setChatDraft] = useState('');
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [typingDots, setTypingDots] = useState('.');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab !== 'Generate' || !selectedJobId) return;

    const loadChats = async () => {
      try {
        const [letterRes, messageRes] = await Promise.all([
          fetch(`/api/jobs/${selectedJobId}/chat?mode=letter`),
          fetch(`/api/jobs/${selectedJobId}/chat?mode=message`),
        ]);

        if (!letterRes.ok || !messageRes.ok) throw new Error('Failed to load chat history');

        const letterData = await letterRes.json();
        const messageData = await messageRes.json();

        setChats({
          letter: letterData.conversation || [],
          message: messageData.conversation || [],
        });
        setChatsLoaded(true);
      } catch (err) {
        console.error('Error loading chats:', err);
        showError('Failed to load chat history. Please try again.');
      }
    };

    loadChats();
  }, [selectedJobId, tab]);

  useEffect(() => {
    if (!isAiTyping) return;
    const interval = setInterval(() => {
      setTypingDots((prev) => {
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '.';
      });
    }, 400);
    return () => clearInterval(interval);
  }, [isAiTyping]);

  const lines = chats[mode];

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [lines, isAiTyping]);

  const canSend = chatDraft.trim().length > 0 && !isSendingChat;
  const canClear = lines.length > 0;

  const handleSend = async () => {
    if (!canSend || !selectedJobId) return;

    const userMessage = chatDraft.trim();
    setChatDraft('');
    setIsSendingChat(true);
    setChats((p) => ({ ...p, [mode]: [...p[mode], { role: 'user', text: userMessage }] }));
    setIsAiTyping(true);

    try {
      const res = await fetch(`/api/jobs/${selectedJobId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, userMessage }),
      });

      if (!res.ok) throw new Error('Failed to send message');

      const data = await res.json();
      setChats((p) => ({ ...p, [mode]: [...p[mode], { role: 'ai', text: data.reply }] }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error sending message';
      showError(msg);
      setChatDraft(userMessage);
      setChats((p) => ({ ...p, [mode]: p[mode].slice(0, -1) }));
    } finally {
      setIsSendingChat(false);
      setIsAiTyping(false);
    }
  };

  const handleClear = async () => {
    if (!selectedJobId) return;

    setChats((p) => ({ ...p, [mode]: [] }));
    setChatDraft('');

    try {
      await fetch(`/api/jobs/${selectedJobId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, conversation: [] }),
      });
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  };

  return {
    mode, setMode,
    chats, setChats,
    chatDraft, setChatDraft,
    chatsLoaded,
    isAiTyping,
    typingDots,
    chatContainerRef,
    lines,
    canSend, canClear,
    handleSend, handleClear,
  };
}
