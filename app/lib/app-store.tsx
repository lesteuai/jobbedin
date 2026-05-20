'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

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
};

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [resumes, setResumes] = useState<Item[]>([]);
  const [jobs, setJobs] = useState<Item[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const refreshResumes = async () => {
    try {
      const res = await fetch('/api/resumes');
      if (!res.ok) throw new Error('Failed to fetch resumes');
      const data = await res.json();
      setResumes(data);
    } catch (err) {
      console.error('Error refreshing resumes:', err);
    }
  };

  useEffect(() => {
    refreshResumes();
  }, []);

  useEffect(() => {
    if (!selectedResumeId) {
      setJobs([]);
      return;
    }
    const fetchJobs = async () => {
      try {
        const res = await fetch(`/api/jobs?resumeId=${selectedResumeId}`);
        if (!res.ok) throw new Error('Failed to fetch jobs');
        const data = await res.json();
        setJobs(data);
      } catch (err) {
        console.error('Error fetching jobs:', err);
      }
    };
    fetchJobs();
  }, [selectedResumeId]);

  const addResume = () => {
    return '';
  };

  const addJob = async (content: string) => {
    if (!selectedResumeId) throw new Error('No resume selected');
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: selectedResumeId, content }),
      });
      if (!res.ok) throw new Error('Failed to add job');
      const newJob = await res.json();
      setJobs((p) => [...p, newJob]);
      return newJob.id;
    } catch (err) {
      console.error('Error adding job:', err);
      throw err;
    }
  };

  const deleteResume = async (id: string) => {
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete resume');
      setResumes((p) => p.filter((x) => x.id !== id));
      if (selectedResumeId === id) setSelectedResumeId(null);
    } catch (err) {
      console.error('Error deleting resume:', err);
      throw err;
    }
  };

  const deleteJob = async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete job');
      setJobs((p) => p.filter((x) => x.id !== id));
      if (selectedJobId === id) setSelectedJobId(null);
    } catch (err) {
      console.error('Error deleting job:', err);
      throw err;
    }
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
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAppStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAppStore must be inside AppStoreProvider");
  return c;
}
