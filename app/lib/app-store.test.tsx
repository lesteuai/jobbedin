import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, renderHook, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStoreProvider, useAppStore, apiErrorMessage } from "./app-store";
import type { Item } from "./app-store";

vi.mock("@/app/lib/auth/client", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "@/app/lib/auth/client";

const mockedUseSession = vi.mocked(useSession);

function withSession(userId: string | null) {
  mockedUseSession.mockReturnValue(
    userId
      ? ({ data: { user: { id: userId } } } as unknown as ReturnType<typeof useSession>)
      : ({ data: null } as unknown as ReturnType<typeof useSession>),
  );
}

// Small helper to build fetch Response-like objects keyed off ok/json.
function makeResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function makeRejectingJsonResponse(ok: boolean): Response {
  return {
    ok,
    json: () => Promise.reject(new Error("not json")),
  } as unknown as Response;
}

describe("apiErrorMessage", () => {
  it("returns the error field from the JSON body", async () => {
    const res = makeResponse(false, { error: "Something broke" });
    await expect(apiErrorMessage(res, "fallback")).resolves.toBe("Something broke");
  });

  it("returns the fallback when the body has no error field", async () => {
    const res = makeResponse(false, { other: "field" });
    await expect(apiErrorMessage(res, "fallback")).resolves.toBe("fallback");
  });

  it("returns the fallback when json() rejects", async () => {
    const res = makeRejectingJsonResponse(false);
    await expect(apiErrorMessage(res, "fallback")).resolves.toBe("fallback");
  });

  it("returns the fallback when error is null", async () => {
    const res = makeResponse(false, { error: null });
    await expect(apiErrorMessage(res, "fallback")).resolves.toBe("fallback");
  });

  it("returns the fallback when error is undefined", async () => {
    const res = makeResponse(false, { error: undefined });
    await expect(apiErrorMessage(res, "fallback")).resolves.toBe("fallback");
  });
});

describe("useAppStore guard", () => {
  it("throws when called outside a provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAppStore())).toThrow(
      "useAppStore must be inside AppStoreProvider",
    );
    consoleError.mockRestore();
  });
});

describe("AppStoreProvider", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mount effect", () => {
    it("fetches /api/resumes on mount when a session exists", async () => {
      withSession("user-1");
      const resumeList: Item[] = [{ id: "r1", name: "Resume 1", content: "content" }];
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, resumeList));

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });

      await waitFor(() => expect(result.current.resumes).toEqual(resumeList));
      expect(global.fetch).toHaveBeenCalledWith("/api/resumes");
    });

    it("does not fetch when there is no session", async () => {
      withSession(null);

      renderHook(() => useAppStore(), { wrapper: AppStoreProvider });

      await waitFor(() => expect(global.fetch).not.toHaveBeenCalled());
    });

    it("surfaces the error message and keeps resumes empty on a not-ok response", async () => {
      withSession("user-1");
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(false, { error: "Nope" }));

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });

      function Consumer() {
        useAppStore();
        return null;
      }
      render(<Consumer />, { wrapper: AppStoreProvider });

      await waitFor(() => expect(result.current.resumes).toEqual([]));
    });

    it("shows the failure message when the fetch rejects", async () => {
      withSession("user-1");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(global.fetch).mockRejectedValue(new Error("network down"));

      function Consumer() {
        useAppStore();
        return null;
      }
      render(<Consumer />, { wrapper: AppStoreProvider });

      await waitFor(() =>
        expect(screen.getByText("Failed to fetch resumes. Please try again.")).toBeInTheDocument(),
      );
      consoleError.mockRestore();
    });
  });

  describe("addJob", () => {
    it("throws No resume selected and issues no fetch when no resume is selected", async () => {
      withSession(null);
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });

      await expect(
        act(async () => {
          await result.current.addJob("job content");
        }),
      ).rejects.toThrow("No resume selected");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("POSTs to /api/jobs with the selected resumeId and content", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(
        makeResponse(true, { id: "j1", name: "Job", content: "job content" }),
      );

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      await act(async () => {
        await result.current.selectResume("r1");
      });
      vi.mocked(global.fetch).mockClear();
      vi.mocked(global.fetch).mockResolvedValue(
        makeResponse(true, { id: "j1", name: "Job", content: "job content" }),
      );

      await act(async () => {
        await result.current.addJob("job content");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({ method: "POST" }),
      );
      const call = vi.mocked(global.fetch).mock.calls[0];
      const init = call[1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual({ resumeId: "r1", content: "job content" });
    });

    it("appends the returned job to jobs on success and returns its id", async () => {
      withSession(null);
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      await act(async () => {
        await result.current.selectResume("r1");
      });

      vi.mocked(global.fetch).mockResolvedValue(
        makeResponse(true, { id: "j1", name: "Job", content: "job content" }),
      );

      let jobId = "";
      await act(async () => {
        jobId = await result.current.addJob("job content");
      });

      expect(jobId).toBe("j1");
      expect(result.current.jobs).toEqual([{ id: "j1", name: "Job", content: "job content" }]);
    });

    it("shows the error and rethrows on a not-ok response, leaving jobs unchanged", async () => {
      withSession(null);
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      await act(async () => {
        await result.current.selectResume("r1");
      });

      vi.mocked(global.fetch).mockResolvedValue(makeResponse(false, { error: "Add failed" }));

      function Consumer() {
        useAppStore();
        return null;
      }
      render(<Consumer />, { wrapper: AppStoreProvider });

      await expect(
        act(async () => {
          await result.current.addJob("job content");
        }),
      ).rejects.toThrow("Add failed");
      expect(result.current.jobs).toEqual([]);
    });
  });

  describe("deleteResume", () => {
    it("removes the resume from the list on success", async () => {
      withSession("user-1");
      const resumeList: Item[] = [{ id: "r1", name: "Resume 1", content: "c" }];
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, resumeList));

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      await waitFor(() => expect(result.current.resumes).toEqual(resumeList));

      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      await act(async () => {
        await result.current.deleteResume("r1");
      });

      expect(result.current.resumes).toEqual([]);
    });

    it("clears selectedResumeId when the deleted id was selected", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      await act(async () => {
        await result.current.selectResume("r1");
      });
      expect(result.current.selectedResumeId).toBe("r1");

      await act(async () => {
        await result.current.deleteResume("r1");
      });

      expect(result.current.selectedResumeId).toBeNull();
    });

    it("leaves selection untouched when a different id is deleted", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      await act(async () => {
        await result.current.selectResume("r1");
      });

      await act(async () => {
        await result.current.deleteResume("r2");
      });

      expect(result.current.selectedResumeId).toBe("r1");
    });

    it("surfaces the error and rejects on a not-ok response, leaving resumes unchanged", async () => {
      withSession("user-1");
      const resumeList: Item[] = [{ id: "r1", name: "Resume 1", content: "c" }];
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, resumeList));

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      await waitFor(() => expect(result.current.resumes).toEqual(resumeList));

      vi.mocked(global.fetch).mockResolvedValue(makeResponse(false, { error: "Delete failed" }));

      function Consumer() {
        useAppStore();
        return null;
      }
      render(<Consumer />, { wrapper: AppStoreProvider });

      await expect(
        act(async () => {
          await result.current.deleteResume("r1");
        }),
      ).rejects.toThrow("Delete failed");
      expect(result.current.resumes).toEqual(resumeList);
    });
  });

  describe("deleteJob", () => {
    it("removes the job from the list on success", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      act(() => {
        result.current.setJobs([{ id: "j1", name: "Job 1", content: "c" }]);
      });

      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      await act(async () => {
        await result.current.deleteJob("j1");
      });

      expect(result.current.jobs).toEqual([]);
    });

    it("clears selectedJobId when the deleted id was selected", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      act(() => {
        result.current.setJobs([{ id: "j1", name: "Job 1", content: "c" }]);
      });
      await act(async () => {
        await result.current.selectJob("j1");
      });

      await act(async () => {
        await result.current.deleteJob("j1");
      });

      expect(result.current.selectedJobId).toBeNull();
    });

    it("leaves selection untouched when a different id is deleted", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      act(() => {
        result.current.setJobs([
          { id: "j1", name: "Job 1", content: "c" },
          { id: "j2", name: "Job 2", content: "c" },
        ]);
      });
      await act(async () => {
        await result.current.selectJob("j1");
      });

      await act(async () => {
        await result.current.deleteJob("j2");
      });

      expect(result.current.selectedJobId).toBe("j1");
    });

    it("surfaces the error and rejects on a not-ok response, leaving jobs unchanged", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      act(() => {
        result.current.setJobs([{ id: "j1", name: "Job 1", content: "c" }]);
      });

      vi.mocked(global.fetch).mockResolvedValue(makeResponse(false, { error: "Delete job failed" }));

      function Consumer() {
        useAppStore();
        return null;
      }
      render(<Consumer />, { wrapper: AppStoreProvider });

      await expect(
        act(async () => {
          await result.current.deleteJob("j1");
        }),
      ).rejects.toThrow("Delete job failed");
      expect(result.current.jobs).toEqual([{ id: "j1", name: "Job 1", content: "c" }]);
    });
  });

  describe("selectResume", () => {
    it("does not fetch when the resume is already loaded with content", async () => {
      withSession("user-1");
      const resumeList: Item[] = [{ id: "r1", name: "Resume 1", content: "already here" }];
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, resumeList));

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      await waitFor(() => expect(result.current.resumes).toEqual(resumeList));
      vi.mocked(global.fetch).mockClear();

      await act(async () => {
        await result.current.selectResume("r1");
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.selectedResumeId).toBe("r1");
    });

    it("fetches the detail endpoint and REPLACES the entry when not loaded", async () => {
      withSession("user-1");
      const resumeList: Item[] = [{ id: "r1", name: "Resume 1", content: "" }];
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, resumeList));

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      await waitFor(() => expect(result.current.resumes).toEqual(resumeList));

      const fetchedResume = { id: "r1", name: "Renamed", content: "full content" };
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, fetchedResume));

      await act(async () => {
        await result.current.selectResume("r1");
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/resumes/r1");
      expect(result.current.resumes).toEqual([fetchedResume]);
    });

    it("surfaces the error and leaves selection set on a not-ok detail response", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(false, { error: "Fetch resume failed" }));

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      function Consumer() {
        useAppStore();
        return null;
      }
      render(<Consumer />, { wrapper: AppStoreProvider });

      await act(async () => {
        await result.current.selectResume("r1");
      });

      expect(result.current.selectedResumeId).toBe("r1");
      expect(screen.getByText("Fetch resume failed")).toBeInTheDocument();
    });

    it("shows the failure message when the detail fetch rejects", async () => {
      withSession(null);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(global.fetch).mockRejectedValue(new Error("network down"));

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      function Consumer() {
        useAppStore();
        return null;
      }
      render(<Consumer />, { wrapper: AppStoreProvider });

      await act(async () => {
        await result.current.selectResume("r1");
      });

      expect(screen.getByText("Failed to fetch resume. Please try again.")).toBeInTheDocument();
      consoleError.mockRestore();
    });
  });

  describe("selectJob", () => {
    it("does not fetch when the job is already loaded with content", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      act(() => {
        result.current.setJobs([{ id: "j1", name: "Job 1", content: "already here" }]);
      });
      vi.mocked(global.fetch).mockClear();

      await act(async () => {
        await result.current.selectJob("j1");
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.selectedJobId).toBe("j1");
    });

    it("fetches the detail endpoint and SPREADS the fetched data over the entry", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      act(() => {
        result.current.setJobs([{ id: "j1", name: "Job 1", content: "" }]);
      });

      vi.mocked(global.fetch).mockResolvedValue(
        makeResponse(true, { content: "full content" }),
      );

      await act(async () => {
        await result.current.selectJob("j1");
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/jobs/j1");
      expect(result.current.jobs).toEqual([{ id: "j1", name: "Job 1", content: "full content" }]);
    });

    it("clears the selection and issues no fetch when called with null", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      act(() => {
        result.current.setJobs([{ id: "j1", name: "Job 1", content: "c" }]);
      });
      await act(async () => {
        await result.current.selectJob("j1");
      });
      vi.mocked(global.fetch).mockClear();

      await act(async () => {
        await result.current.selectJob(null);
      });

      expect(result.current.selectedJobId).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("surfaces the error and leaves selection set on a not-ok detail response", async () => {
      withSession(null);
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, {}));
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      act(() => {
        result.current.setJobs([{ id: "j1", name: "Job 1", content: "" }]);
      });

      vi.mocked(global.fetch).mockResolvedValue(makeResponse(false, { error: "Fetch job failed" }));

      function Consumer() {
        useAppStore();
        return null;
      }
      render(<Consumer />, { wrapper: AppStoreProvider });

      await act(async () => {
        await result.current.selectJob("j1");
      });

      expect(result.current.selectedJobId).toBe("j1");
      expect(screen.getByText("Fetch job failed")).toBeInTheDocument();
    });

    it("shows the failure message when the detail fetch rejects", async () => {
      withSession(null);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      act(() => {
        result.current.setJobs([{ id: "j1", name: "Job 1", content: "" }]);
      });

      vi.mocked(global.fetch).mockRejectedValue(new Error("network down"));

      function Consumer() {
        useAppStore();
        return null;
      }
      render(<Consumer />, { wrapper: AppStoreProvider });

      await act(async () => {
        await result.current.selectJob("j1");
      });

      expect(screen.getByText("Failed to fetch job. Please try again.")).toBeInTheDocument();
      consoleError.mockRestore();
    });
  });

  describe("clearStore", () => {
    it("empties resumes, jobs, and both selections", async () => {
      withSession("user-1");
      const resumeList: Item[] = [{ id: "r1", name: "Resume 1", content: "c" }];
      vi.mocked(global.fetch).mockResolvedValue(makeResponse(true, resumeList));

      const { result } = renderHook(() => useAppStore(), { wrapper: AppStoreProvider });
      await waitFor(() => expect(result.current.resumes).toEqual(resumeList));

      act(() => {
        result.current.setJobs([{ id: "j1", name: "Job 1", content: "c" }]);
      });
      await act(async () => {
        await result.current.selectResume("r1");
      });
      await act(async () => {
        await result.current.selectJob("j1");
      });

      act(() => {
        result.current.clearStore();
      });

      expect(result.current.resumes).toEqual([]);
      expect(result.current.jobs).toEqual([]);
      expect(result.current.selectedResumeId).toBeNull();
      expect(result.current.selectedJobId).toBeNull();
    });
  });

  describe("error modal round-trip", () => {
    function Consumer() {
      const { showError } = useAppStore();
      return (
        <button type="button" onClick={() => showError("boom")}>
          Trigger error
        </button>
      );
    }

    it("renders YmErrorModal with the given message when showError is called", async () => {
      withSession(null);
      const user = userEvent.setup();
      render(
        <AppStoreProvider>
          <Consumer />
        </AppStoreProvider>,
      );

      await user.click(screen.getByRole("button", { name: "Trigger error" }));

      expect(screen.getByText("boom")).toBeInTheDocument();
    });

    it("dismisses the modal when the OK button is clicked", async () => {
      withSession(null);
      const user = userEvent.setup();
      render(
        <AppStoreProvider>
          <Consumer />
        </AppStoreProvider>,
      );

      await user.click(screen.getByRole("button", { name: "Trigger error" }));
      expect(screen.getByText("boom")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "OK" }));

      expect(screen.queryByText("boom")).not.toBeInTheDocument();
    });
  });
});
