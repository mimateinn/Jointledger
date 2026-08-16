"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      setTheme(current);
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("jl-theme", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle}>
      {theme === "dark" ? "暖紙白" : "炭橄欖"}
    </button>
  );
}
