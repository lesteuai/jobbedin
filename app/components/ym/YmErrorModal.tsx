"use client";

import { YmButton } from "./YmButton";

type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
};

export function YmErrorModal({ open, message, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="ym-modal-overlay" onClick={onClose}>
      <div
        className="ym-window"
        style={{ width: 360 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ym-titlebar">
          <span>⚠ Error</span>
        </div>
        <div style={{ padding: 18, fontSize: 12 }}>{message}</div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "0 12px 12px",
          }}
        >
          <YmButton onClick={onClose} variant="primary" style={{ minWidth: 72 }}>
            OK
          </YmButton>
        </div>
      </div>
    </div>
  );
}
