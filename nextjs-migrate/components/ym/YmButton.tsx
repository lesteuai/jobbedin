"use client";

import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary";
};

export function YmButton({ variant = "default", className = "", ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`ym-btn ${variant === "primary" ? "ym-btn-primary" : ""} ${className}`}
    />
  );
}
