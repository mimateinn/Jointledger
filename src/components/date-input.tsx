"use client";

import type { InputHTMLAttributes } from "react";
import { ISO_DATE_INPUT } from "@/lib/format";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Display-only YYYY-MM-DD. Stored value stays the ISO calendar date. */
export function DateInput({ className, ...props }: DateInputProps) {
  return (
    <input
      {...props}
      className={["input", "input-date", className].filter(Boolean).join(" ")}
      type="text"
      inputMode="numeric"
      placeholder="YYYY-MM-DD"
      pattern={ISO_DATE_INPUT}
      autoComplete="off"
    />
  );
}
