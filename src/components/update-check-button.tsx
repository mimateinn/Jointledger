"use client";

import { useCallback, useState } from "react";

type UpdateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; message: string; needRestart?: boolean }
  | { status: "error"; message: string };

export function UpdateCheckButton() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [pressed, setPressed] = useState(false);

  const onCheck = useCallback(async () => {
    if (state.status === "loading") return;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        needRestart?: boolean;
      };

      if (res.status === 401) {
        setState({ status: "error", message: "請先登入（示範：小明 / demo@example.com）" });
        return;
      }
      if (!res.ok) {
        setState({
          status: "error",
          message: data.message || data.error || `HTTP ${res.status}`,
        });
        return;
      }

      if (data.needRestart) {
        setState({
          status: "ok",
          message: data.message || "已更新。請重新啟動（再跑 start.sh / start.bat），資料夾同資料庫唔變。",
          needRestart: true,
        });
      } else {
        setState({
          status: "ok",
          message: data.message || "已是最新官方版本",
        });
      }
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "網路錯誤",
      });
    }
  }, [state.status]);

  const isLoading = state.status === "loading";

  return (
    <div>
      <button
        type="button"
        className="theme-toggle"
        onClick={onCheck}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        disabled={isLoading}
        aria-label="檢查更新"
        title="檢查官方更新"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          transform: pressed || isLoading ? "translateY(2px) scale(0.98)" : undefined,
          transition: "transform 100ms ease-out",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/settings-update-icon.png"
          alt=""
          width={18}
          height={18}
          style={{
            width: 18,
            height: 18,
            objectFit: "contain",
            opacity: isLoading ? 0.35 : 1,
          }}
        />
        {isLoading ? "檢查中…" : "檢查更新"}
      </button>
      {state.status === "ok" ? (
        <p className={state.needRestart ? "ok" : "meta muted"} style={{ marginTop: 8 }}>
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? <p className="alert" style={{ marginTop: 8 }}>{state.message}</p> : null}
    </div>
  );
}
