'use client';

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { AppFrame } from "@/app/lib/components/ym/AppFrame";
import { Sidebar } from "@/app/lib/components/ym/Sidebar";
import { YmModal } from "@/app/lib/components/ym/YmModal";
import { YmButton } from "@/app/lib/components/ym/YmButton";
import { MarkdownPanel } from "@/app/lib/components/ym/MarkdownPanel";
import { useAppStore } from "@/app/lib/app-store";
import { useSession } from "@/app/lib/auth/client";

export default function ResumesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const {
    resumes,
    selectedResumeId,
    selectResume,
    deleteResume,
    refreshResumes,
    showError,
  } = useAppStore();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPending && !session?.user) router.replace('/');
  }, [isPending, session?.user, router]);
  
  const selected = resumes.find((r) => r.id === selectedResumeId);
  const pendingName = resumes.find((r) => r.id === pendingDelete)?.name;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/resumes', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showError(json?.error ?? 'Failed to upload resume');
        return;
      }
      const newResume = await res.json();

      await refreshResumes();
      selectResume(newResume.id);
    } catch (err) {
      console.error('Error uploading resume:', err);
      showError('Failed to upload resume. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return ( session ?
    <AppFrame>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <Sidebar
        title="Resumes"
        addLabel={isUploading ? "Uploading..." : "+ Add resume"}
        onAdd={() => fileInputRef.current?.click()}
        items={resumes}
        selectedId={selectedResumeId}
        onSelect={selectResume}
        onDelete={(id) => setPendingDelete(id)}
      />

      <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 10, minHeight: 0, overflow: "hidden" }}>
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
                <p style={{ fontSize: 11 }}>(Supports .pdf, .txt, .md)</p>
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
                onClick={() => router.push(`/resumes/${selectedResumeId}`)}
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
  : null);
}
