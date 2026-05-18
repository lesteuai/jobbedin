"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

export function AppFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
      }}
    >
      <div
        className="ym-window"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          borderRadius: 0,
          position: "relative",
        }}
      >
        <div className="ym-titlebar">
          <span style={{ fontSize: 14, flex: 1 }}>☺ JobbedIn</span>
          <button className="ym-winbtn">_</button>
          <button className="ym-winbtn">▭</button>
          <button className="ym-winbtn">×</button>
        </div>

        <button
          className="ym-btn"
          onClick={() => router.push("/")}
          style={{
            position: "absolute",
            top: 32,
            right: 8,
            zIndex: 10,
          }}
        >
          Sign Out
        </button>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
}
