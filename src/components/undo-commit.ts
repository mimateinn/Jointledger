"use client";

import { useEffect, useRef, useState } from "react";

export const UNDO_MS = 8000;

export function useUndoCommit(ms = UNDO_MS, onCommit?: () => void) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "undo">("idle");
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (phase !== "undo") {
      return;
    }
    const timer = window.setTimeout(() => {
      onCommitRef.current?.();
    }, ms);
    return () => window.clearTimeout(timer);
  }, [phase, ms]);

  return { phase, setPhase };
}
