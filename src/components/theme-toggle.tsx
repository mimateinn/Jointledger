"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "./icons";

const COPY = {
  light: "暖紙",
  dark: "墨紙",
  reduce: "減少動態",
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      setTheme(current);
    }
    setReduced(document.documentElement.classList.contains("is-reduced"));
  }, []);

  function applyTheme(next: "dark" | "light") {
    setTheme(next);
    const root = document.documentElement;
    root.classList.add("theme-fade");
    root.setAttribute("data-theme", next);
    window.setTimeout(() => root.classList.remove("theme-fade"), 160);
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

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="seg" style={{ "--seg-n": 2, "--seg-i": theme === "light" ? 0 : 1 } as CSSProperties}>
        <span className="seg-thumb" aria-hidden />
        <button
          type="button"
          aria-pressed={theme === "light"}
          className="theme-toggle"
          onClick={() => applyTheme("light")}
        >
          <Icon name="theme-sun" size={16} />
          {COPY.light}
        </button>
        <button
          type="button"
          aria-pressed={theme === "dark"}
          className="theme-toggle"
          onClick={() => applyTheme("dark")}
        >
          <Icon name="theme-moon" size={16} />
          {COPY.dark}
        </button>
      </div>
      <button type="button" className="btn btn-ghost" aria-pressed={reduced} onClick={toggleReduced}>
        {COPY.reduce}
      </button>
    </div>
  );
}
