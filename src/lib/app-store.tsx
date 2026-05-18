import { createContext, useContext, useState, type ReactNode } from "react";

export type Item = { id: string; name: string; content: string };

type Store = {
  resumes: Item[];
  jobs: Item[];
  selectedResumeId: string | null;
  selectedJobId: string | null;
  addResume: (name?: string) => string;
  addJob: (content: string) => string;
  deleteResume: (id: string) => void;
  deleteJob: (id: string) => void;
  selectResume: (id: string | null) => void;
  selectJob: (id: string | null) => void;
};

const Ctx = createContext<Store | null>(null);

const SAMPLE_RESUME = `# Jane Doe
**Software Engineer** · jane@example.com · github.com/janedoe

## Experience
- **Acme Corp** — Senior Engineer (2022–Present). Shipped 3 AI agent products.
- **Globex** — Engineer (2019–2022). Led migration to TypeScript across 40k LoC.

## Skills
TypeScript, React, Python, LLM tooling, Postgres, AWS.

## Education
B.S. Computer Science, State University, 2019.`;

const SAMPLE_JOB = `Senior Full-Stack Engineer — Babyscripts (Remote)

We're building data-driven maternal-health software. Looking for engineers with:
- 4+ years TypeScript / React
- Experience shipping LLM-powered features
- Comfort with Postgres + cloud infra
- Bias toward clear writing and ownership`;

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [resumes, setResumes] = useState<Item[]>([
    { id: "r1", name: "Resume 1", content: SAMPLE_RESUME },
    { id: "r2", name: "Resume 2", content: SAMPLE_RESUME.replace("Jane Doe", "Alex Park") },
  ]);
  const [jobs, setJobs] = useState<Item[]>([
    { id: "j1", name: "Job 1", content: SAMPLE_JOB },
    { id: "j2", name: "Job 2", content: SAMPLE_JOB.replace("Babyscripts", "Northwind Labs") },
  ]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const addResume = (name?: string) => {
    const id = `r${Date.now()}`;
    const n = name ?? `Resume ${resumes.length + 1}`;
    setResumes((p) => [...p, { id, name: n, content: SAMPLE_RESUME }]);
    return id;
  };
  const addJob = (content: string) => {
    const id = `j${Date.now()}`;
    const n = `Job ${jobs.length + 1}`;
    setJobs((p) => [...p, { id, name: n, content }]);
    return id;
  };
  const deleteResume = (id: string) => {
    setResumes((p) => p.filter((x) => x.id !== id));
    if (selectedResumeId === id) setSelectedResumeId(null);
  };
  const deleteJob = (id: string) => {
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
