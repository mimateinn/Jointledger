"use client";

import { useEffect, useRef, useState } from "react";

export const UNDO_MS = 8000;

export function useUndoCommit(ms = UNDO_MS, onCommit?: () => void) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "undo">("idle");
  const formRef = useRef<HTMLFormElement>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (phase !== "undo") {
      return;
    }
    const timer = window.setTimeout(() => {
      if (onCommitRef.current) {
        onCommitRef.current();
        return;
      }
      formRef.current?.requestSubmit();
    }, ms);
    return () => window.clearTimeout(timer);
  }, [phase, ms]);

  return { phase, setPhase, formRef };
}
