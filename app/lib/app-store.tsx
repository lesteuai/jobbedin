'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useSession } from "@/app/lib/auth-client";
import { YmErrorModal } from "@/app/components/ym/YmErrorModal";

export type Item = { id: string; name: string; content: string };

type Store = {
  resumes: Item[];
  jobs: Item[];
  selectedResumeId: string | null;
  selectedJobId: string | null;
  addResume: (name?: string) => string;
  addJob: (content: string) => Promise<string>;
  deleteResume: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  selectResume: (id: string | null) => void;
  selectJob: (id: string | null) => void;
  refreshResumes: () => Promise<void>;
  clearStore: () => void;
  showError: (message: string) => void;
};

const Ctx = createContext<Store | null>(null);

async function apiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const json = await res.json();
    return json?.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [resumes, setResumes] = useState<Item[]>([]);
  const [jobs, setJobs] = useState<Item[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { data: session } = useSession();

  const showError = (message: string) => setErrorMessage(message);
  const clearError = () => setErrorMessage(null);

  const refreshResumes = async () => {
    try {
      const res = await fetch('/api/resumes');
      if (!res.ok) {
        const msg = await apiErrorMessage(res, 'Failed to fetch resumes');
        showError(msg);
        return;
      }
      const data = await res.json();
      setResumes(data);
    } catch (err) {
      console.error('Error refreshing resumes:', err);
      showError('Failed to fetch resumes. Please try again.');
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      refreshResumes();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!selectedResumeId) {
      setJobs([]);
      return;
    }
    const fetchJobs = async () => {
      try {
        const res = await fetch(`/api/jobs?resumeId=${selectedResumeId}`);
        if (!res.ok) {
          const msg = await apiErrorMessage(res, 'Failed to fetch jobs');
          showError(msg);
          return;
        }
        const data = await res.json();
        setJobs(data);
      } catch (err) {
        console.error('Error fetching jobs:', err);
        showError('Failed to fetch jobs. Please try again.');
      }
    };
    fetchJobs();
  }, [selectedResumeId]);

  const clearStore = () => {
    setResumes([]);
    setJobs([]);
    setSelectedResumeId(null);
    setSelectedJobId(null);
  };

  const addResume = () => {
    return '';
  };

  const addJob = async (content: string) => {
    if (!selectedResumeId) throw new Error('No resume selected');
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeId: selectedResumeId, content }),
    });
    if (!res.ok) {
      const msg = await apiErrorMessage(res, 'Failed to add job');
      showError(msg);
      throw new Error(msg);
    }
    const newJob = await res.json();
    setJobs((p) => [...p, newJob]);
    return newJob.id;
  };

  const deleteResume = async (id: string) => {
    const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const msg = await apiErrorMessage(res, 'Failed to delete resume');
      showError(msg);
      throw new Error(msg);
    }
    setResumes((p) => p.filter((x) => x.id !== id));
    if (selectedResumeId === id) setSelectedResumeId(null);
  };

  const deleteJob = async (id: string) => {
    const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const msg = await apiErrorMessage(res, 'Failed to delete job');
      showError(msg);
      throw new Error(msg);
    }
    setJobs((p) => p.filter((x) => x.id !== id));
    if (selectedJobId === id) setSelectedJobId(null);
  };

  return (
    <Ctx.Provider
      value={{
        resumes,
        jobs,
        selectedResumeId,
        selectedJobId,
        addResume,
        addJob,
        deleteResume,
        deleteJob,
        selectResume: setSelectedResumeId,
        selectJob: setSelectedJobId,
        refreshResumes,
        clearStore,
        showError,
      }}
    >
      {children}
      <YmErrorModal
        open={errorMessage !== null}
        message={errorMessage ?? ''}
        onClose={clearError}
      />
    </Ctx.Provider>
  );
}

export function useAppStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppStore must be inside AppStoreProvider");
  return c;
}
