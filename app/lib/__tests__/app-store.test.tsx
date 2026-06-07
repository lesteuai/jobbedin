import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { AppStoreProvider, useAppStore } from '@/app/lib/app-store';

vi.mock('@/app/lib/auth/client', () => ({
  authClient: {},
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

import { useSession } from '@/app/lib/auth/client';

function renderStore() {
  const storeRef = { current: null as any };

  function TestConsumer() {
    const store = useAppStore();
    storeRef.current = store;
    return null;
  }

  const result = render(
    <AppStoreProvider>
      <TestConsumer />
    </AppStoreProvider>
  );

  return () => ({
    store: storeRef.current,
    container: result.container
  });
}

describe('AppStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'user-1' } },
    } as any);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initialization', () => {
    it('calls refreshResumes on mount when session exists', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'r1', name: 'resume1', content: 'content' }],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        const store = getStore().store;
        expect(store).toBeDefined();
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
        expect(store.resumes).toEqual([{ id: 'r1', name: 'resume1', content: 'content' }]);
      });
    });

    it('does not call refreshResumes if session is missing', async () => {
      vi.mocked(useSession).mockReturnValue({ data: null } as any);
      const mockFetch = vi.mocked(global.fetch);

      renderStore();
      // Wait a bit to ensure the effect would have run if session was present
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockFetch).not.toHaveBeenCalled();

      // Restore the mock for other tests
      vi.mocked(useSession).mockReturnValue({
        data: { user: { id: 'user-1' } },
      } as any);
    });
  });

  describe('clearStore', () => {
    it('resets resumes, jobs, and selections to initial state', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'r1', name: 'resume1', content: 'c1' }],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        const { store } = getStore();
        expect(store).toBeDefined();
        expect(store.resumes.length).toBeGreaterThan(0);
      });

      let { store } = getStore();
      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: 'jc1' }]);
      });

      ({ store } = getStore());
      expect(store.jobs.length).toBeGreaterThan(0);

      await act(async () => {
        store.clearStore();
      });

      ({ store } = getStore());
      expect(store.resumes).toEqual([]);
      expect(store.jobs).toEqual([]);
      expect(store.selectedResumeId).toBeNull();
      expect(store.selectedJobId).toBeNull();
    });
  });

  describe('selectJob - lazy loading', () => {
    it('fetches job content if not already loaded', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: '' }]);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'j1', name: 'job1', content: 'full content' }),
      } as any);

      ({ store } = getStore());
      await act(async () => {
        await store.selectJob('j1');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/jobs/j1');

      ({ store } = getStore());
      const job = store.jobs.find((j: any) => j.id === 'j1');
      expect(job?.content).toBe('full content');
    });

    it('does not fetch if job already has content loaded', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: 'already loaded' }]);
      });

      mockFetch.mockClear();

      ({ store } = getStore());
      await act(async () => {
        await store.selectJob('j1');
      });

      expect(mockFetch).not.toHaveBeenCalled();

      await waitFor(() => {
        ({ store } = getStore());
        expect(store.selectedJobId).toBe('j1');
      });
    });

    it('sets selectedJobId even if content not found', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: '' }]);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'j1', name: 'job1', content: 'new content' }),
      } as any);

      ({ store } = getStore());
      await act(async () => {
        await store.selectJob('j1');
      });

      await waitFor(() => {
        ({ store } = getStore());
        expect(store.selectedJobId).toBe('j1');
      });
    });

    it('does not throw on fetch failure (showError is called)', async () => {
      const mockFetch = vi.mocked(global.fetch);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();

      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: '' }]);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      } as any);

      ({ store } = getStore());
      // selectJob should not throw on failed response, just call showError
      await act(async () => {
        await store.selectJob('j1');
      });

      // Verify the selectedJobId was still set even though the fetch failed
      ({ store } = getStore());
      expect(store.selectedJobId).toBe('j1');
    });

    it('handles selectJob(null) by clearing selection', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: 'c1' }]);
      });

      ({ store } = getStore());
      await act(async () => {
        await store.selectJob('j1');
      });

      await waitFor(() => {
        ({ store } = getStore());
        expect(store.selectedJobId).toBe('j1');
      });

      await act(async () => {
        await store.selectJob(null);
      });

      ({ store } = getStore());
      expect(store.selectedJobId).toBeNull();
    });
  });

  describe('selectResume - lazy loading', () => {
    it('fetches resume content if not already loaded', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'r1', name: 'resume1', content: '' }],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'r1', name: 'resume1', content: 'full resume' }),
      } as any);

      let { store } = getStore();
      await act(async () => {
        await store.selectResume('r1');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/resumes/r1');

      ({ store } = getStore());
      const resume = store.resumes.find((r: any) => r.id === 'r1');
      expect(resume?.content).toBe('full resume');
    });

    it('does not fetch if resume already has content loaded', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'r1', name: 'resume1', content: 'already loaded' }],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      mockFetch.mockClear();

      let { store } = getStore();
      await act(async () => {
        await store.selectResume('r1');
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('addJob', () => {
    it('posts to /api/jobs with resumeId and content, updates jobs list', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'r1', name: 'resume1', content: 'c1' }],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        await store.selectResume('r1');
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'j1', name: 'Job 1', content: '' }),
      } as any);

      ({ store } = getStore());
      await act(async () => {
        const jobId = await store.addJob('job description');
        expect(jobId).toBe('j1');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/jobs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeId: 'r1', content: 'job description' }),
        })
      );

      ({ store } = getStore());
      expect(store.jobs).toContainEqual(expect.objectContaining({ id: 'j1' }));
    });

    it('throws error if no resume selected', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      expect(store.selectedResumeId).toBeNull();

      await expect(
        act(async () => {
          await store.addJob('job description');
        })
      ).rejects.toThrow('No resume selected');
    });

    it('shows error on failed POST', async () => {
      const mockFetch = vi.mocked(global.fetch);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'r1', name: 'resume1', content: 'c1' }],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        await store.selectResume('r1');
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      } as any);

      ({ store } = getStore());
      await expect(
        act(async () => {
          await store.addJob('job description');
        })
      ).rejects.toThrow('Server error');
    });
  });

  describe('deleteResume', () => {
    it('calls DELETE /api/resumes/[id] and removes from list', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'r1', name: 'resume1', content: 'c1' }],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      let { store } = getStore();
      await act(async () => {
        await store.deleteResume('r1');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/resumes/r1', { method: 'DELETE' });

      ({ store } = getStore());
      expect(store.resumes).not.toContainEqual(expect.objectContaining({ id: 'r1' }));
    });

    it('clears selectedResumeId if deleted resume is selected', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'r1', name: 'resume1', content: 'c1' }],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        await store.selectResume('r1');
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      ({ store } = getStore());
      expect(store.selectedResumeId).toBe('r1');

      await act(async () => {
        await store.deleteResume('r1');
      });

      ({ store } = getStore());
      expect(store.selectedResumeId).toBeNull();
    });

    it('throws on failed DELETE', async () => {
      const mockFetch = vi.mocked(global.fetch);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'r1', name: 'resume1', content: 'c1' }],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Delete failed' }),
      } as any);

      let { store } = getStore();
      await expect(
        act(async () => {
          await store.deleteResume('r1');
        })
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('deleteJob', () => {
    it('calls DELETE /api/jobs/[id] and removes from list', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: 'c1' }]);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      ({ store } = getStore());
      await act(async () => {
        await store.deleteJob('j1');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/jobs/j1', { method: 'DELETE' });

      ({ store } = getStore());
      expect(store.jobs).not.toContainEqual(expect.objectContaining({ id: 'j1' }));
    });

    it('clears selectedJobId if deleted job is selected', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: 'c1' }]);
      });

      await act(async () => {
        await store.selectJob('j1');
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      ({ store } = getStore());
      expect(store.selectedJobId).toBe('j1');

      await act(async () => {
        await store.deleteJob('j1');
      });

      ({ store } = getStore());
      expect(store.selectedJobId).toBeNull();
    });

    it('calls showError on failed DELETE', async () => {
      const mockFetch = vi.mocked(global.fetch);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: 'c1' }]);
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Delete failed' }),
      } as any);

      ({ store } = getStore());
      await expect(
        act(async () => {
          await store.deleteJob('j1');
        })
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('error handling', () => {
    it('handles network errors in refreshResumes', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const getStore = renderStore();
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      const { store } = getStore();
      expect(store.resumes).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('handles network errors in selectJob', async () => {
      const mockFetch = vi.mocked(global.fetch);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const getStore = renderStore();
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/resumes');
      });

      let { store } = getStore();
      await act(async () => {
        store.setJobs([{ id: 'j1', name: 'job1', content: '' }]);
      });

      mockFetch.mockClear();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      store = getStore().store;
      await act(async () => {
        await store.selectJob('j1');
      });

      expect(consoleErrorSpy).toHaveBeenCalled();

      await waitFor(() => {
        const { container } = getStore();
        expect(container.textContent).toContain('Failed to fetch job. Please try again.');
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
