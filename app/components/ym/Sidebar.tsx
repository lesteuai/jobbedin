"use client";

import type { ReactNode } from "react";
import { YmButton } from "./YmButton";

type SidebarItem = {
  id: string;
  name: string;
};

type Props = {
  title: string;
  addLabel: string;
  onAdd: () => void;
  items: SidebarItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  header?: ReactNode;
  footer?: ReactNode;
};

export function Sidebar({
  title,
  addLabel,
  onAdd,
  items,
  selectedId,
  onSelect,
  onDelete,
  header,
  footer,
}: Props) {
  return (
    <div
      className="ym-panel"
      style={{
        width: 200,
        display: "flex",
        flexDirection: "column",
        padding: 8,
        gap: 8,
      }}
    >
      {header}
      <div
        style={{
          fontWeight: "bold",
          fontSize: 13,
          color: "oklch(0.4 0.2 295)",
          textTransform: "uppercase",
          letterSpacing: 1,
          padding: "0 2px",
        }}
      >
        ★ {title}
      </div>
      <YmButton onClick={onAdd} variant="primary">{addLabel}</YmButton>
      <div className="ym-inset" style={{ flex: 1, padding: 4, overflow: "auto" }}>
        {items.length === 0 && (
          <div style={{ padding: 8, color: "#888", fontStyle: "italic" }}>
            (empty)
          </div>
        )}
        {items.map((it) => (
          <div
            key={it.id}
            className="ym-listitem"
            data-active={selectedId === it.id}
            onClick={() => onSelect(it.id)}
          >
            <span style={{ flex: 1 }}>📄 {it.name}</span>
            <button
              className="ym-x"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(it.id);
              }}
              aria-label={`Delete ${it.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}
