"use client";

import { useEffect, useRef, useState } from "react";
import { Decimal } from "decimal.js";

function prefersReduced(): boolean {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("is-reduced")) {
    return true;
  }
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCountTo(
  target: string | null,
  format: (value: string) => string,
  enabled = true,
): { text: string; flash: "up" | "down" | null } {
  const [text, setText] = useState(target == null ? "—" : format(target));
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const shown = useRef<Decimal | null>(target == null ? null : new Decimal(target));
  const first = useRef(true);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (target == null) {
      shown.current = null;
      setText("—");
      first.current = false;
      return;
    }
    const next = new Decimal(target);
    if (first.current || !enabled || prefersReduced() || shown.current == null) {
      first.current = false;
      shown.current = next;
      setText(format(target));
      return;
    }
    const from = shown.current;
    const delta = next.minus(from);
    if (delta.abs().lt(0.005) || delta.abs().gt(new Decimal(1e6).mul(Decimal.max(1, from.abs())))) {
      shown.current = next;
      setText(format(target));
      return;
    }
    if (raf.current) {
      cancelAnimationFrame(raf.current);
    }
    const dir = delta.gt(0) ? "up" : "down";
    setFlash(dir);
    const t0 = performance.now();
    const duration = 320;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - (1 - p) ** 3;
      const current = from.plus(delta.mul(e));
      shown.current = current;
      setText(format(current.toFixed(2)));
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        shown.current = next;
        setText(format(target));
        window.setTimeout(() => setFlash(null), 600);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, format, enabled]);

  return { text, flash };
}
