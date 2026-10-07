"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "./icons";

type ThemePref = "light" | "dark" | "system";

const COPY = {
  light: "暖紙",
  dark: "夜頁",
  system: "跟系統",
  reduce: "減少動態",
};

function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "light" || pref === "dark") {
    return pref;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("dark");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("jl-theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      setPref(stored);
    } else {
      const current = document.documentElement.getAttribute("data-theme");
      if (current === "light" || current === "dark") {
        setPref(current);
      }
    }
    setReduced(document.documentElement.classList.contains("is-reduced"));
  }, []);

  useEffect(() => {
    if (pref !== "system") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [pref]);

  function applyPref(next: ThemePref) {
    setPref(next);
    const root = document.documentElement;
    root.classList.add("theme-fade");
    root.setAttribute("data-theme", resolveTheme(next));
    root.setAttribute("data-theme-pref", next);
    window.setTimeout(() => root.classList.remove("theme-fade"), 300);
    try {
      localStorage.setItem("jl-theme", next);
    } catch {
      /* ignore */
    }
  }

  function toggleReduced() {
    const next = !reduced;
    setReduced(next);
    document.documentElement.classList.toggle("is-reduced", next);
    try {
      localStorage.setItem("jl-reduced", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const index = pref === "light" ? 0 : pref === "dark" ? 1 : 2;

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="seg" style={{ "--seg-n": 3, "--seg-i": index } as CSSProperties}>
        <span className="seg-thumb" aria-hidden />
        <button type="button" aria-pressed={pref === "light"} className="theme-toggle" onClick={() => applyPref("light")}>
          <Icon name="theme-sun" size={16} />
          {COPY.light}
        </button>
        <button type="button" aria-pressed={pref === "dark"} className="theme-toggle" onClick={() => applyPref("dark")}>
          <Icon name="theme-moon" size={16} />
          {COPY.dark}
        </button>
        <button type="button" aria-pressed={pref === "system"} className="theme-toggle" onClick={() => applyPref("system")}>
          {COPY.system}
        </button>
      </div>
      <button type="button" className="btn btn-ghost" aria-pressed={reduced} onClick={toggleReduced}>
        {COPY.reduce}
      </button>
    </div>
  );
}
