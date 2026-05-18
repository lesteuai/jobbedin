"use client";

import type { ReactNode } from "react";
import { YmButton } from "./YmButton";

type Props = {
  open: boolean;
  title?: string;
  children: ReactNode;
  okLabel?: string;
  cancelLabel?: string;
  onOk: () => void;
  onCancel: () => void;
};

export function YmModal({
  open,
  title = "JobbedIn",
  children,
  okLabel = "OK",
  cancelLabel = "Cancel",
  onOk,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="ym-modal-overlay" onClick={onCancel}>
      <div
        className="ym-window"
        style={{ width: 360 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ym-titlebar">
          <span>⚠ {title}</span>
        </div>
        <div style={{ padding: 18, fontSize: 12 }}>{children}</div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "0 12px 12px",
          }}
        >
          <YmButton onClick={onOk} variant="primary" style={{ minWidth: 72 }}>
            {okLabel}
          </YmButton>
          <YmButton onClick={onCancel} style={{ minWidth: 72 }}>
            {cancelLabel}
          </YmButton>
        </div>
      </div>
    </div>
  );
}
