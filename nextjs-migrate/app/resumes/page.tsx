'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppFrame } from "@/components/ym/AppFrame";
import { Sidebar } from "@/components/ym/Sidebar";
import { YmModal } from "@/components/ym/YmModal";
import { YmButton } from "@/components/ym/YmButton";
import { MarkdownPanel } from "@/components/ym/MarkdownPanel";
import { useAppStore } from "@/lib/app-store";

export default function ResumesPage() {
  const router = useRouter();
  const {
    resumes,
    selectedResumeId,
    selectResume,
    addResume,
    deleteResume,
  } = useAppStore();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const selected = resumes.find((r) => r.id === selectedResumeId);
  const pendingName = resumes.find((r) => r.id === pendingDelete)?.name;

  return (
    <AppFrame>
      <Sidebar
        title="Resumes"
        addLabel="+ Add resume"
        onAdd={() => {
          const id = addResume();
          selectResume(id);
        }}
        items={resumes}
        selectedId={selectedResumeId}
        onSelect={selectResume}
        onDelete={(id) => setPendingDelete(id)}
      />

      <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {!selected ? (
          <>
            <div style={{ fontWeight: "bold", fontSize: 13, visibility: "hidden" }}>
              placeholder
            </div>
            <div
              className="ym-inset"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
                fontStyle: "italic",
                padding: 24,
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 36 }}>📄</div>
                <p>Select a resume from the left, or click <b>+ Add resume</b>.</p>
                <p style={{ fontSize: 11 }}>(Supports .pdf and .docx — mock)</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: "bold", fontSize: 13 }}>
              📄 {selected.name} — preview
            </div>
            <MarkdownPanel>{selected.content}</MarkdownPanel>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <YmButton
                variant="primary"
                onClick={() => router.push("/jobs")}
              >
                To Job →
              </YmButton>
            </div>
          </>
        )}
      </div>

      <YmModal
        open={pendingDelete !== null}
        title="Confirm delete"
        onOk={() => {
          if (pendingDelete) deleteResume(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      >
        Are you sure you want to delete <b>{pendingName}</b>?
      </YmModal>
    </AppFrame>
  );
}
