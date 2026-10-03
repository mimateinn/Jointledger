"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./icons";

const COPY = {
  idle: "檢查更新",
  loading: "檢查中…",
  login: "請先登入再檢查更新",
  latest: "已是最新官方版本",
  restart: "已更新。請重新啟動應用（資料同資料庫唔會變）。",
  fail: "檢查唔到更新，請稍後再試",
  aria: "檢查更新",
};

type UpdateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; message: string; needRestart?: boolean }
  | { status: "error"; message: string };

export function UpdateCheckButton() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

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
        setState({ status: "error", message: COPY.login });
        return;
      }
      if (!res.ok) {
        setState({
          status: "error",
          message: COPY.fail,
        });
        return;
      }

      if (data.needRestart) {
        setState({
          status: "ok",
          message: data.message || COPY.restart,
          needRestart: true,
        });
      } else {
        setState({
          status: "ok",
          message: data.message || COPY.latest,
        });
      }
    } catch {
      setState({
        status: "error",
        message: COPY.fail,
      });
    }
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "ok" || state.needRestart) {
      return;
    }
    const id = window.setTimeout(() => setState({ status: "idle" }), 5000);
    return () => window.clearTimeout(id);
  }, [state]);

  const isLoading = state.status === "loading";
  const dataState = state.status === "idle" ? "idle" : state.status;

  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary btn-update"
        data-state={dataState}
        onClick={onCheck}
        disabled={isLoading}
        aria-busy={isLoading}
        aria-label={COPY.aria}
        title={COPY.aria}
      >
        {state.status === "ok" ? (
          <Icon name="success-check" className="icon-ok" />
        ) : (
          <Icon name="check-update" />
        )}
        {isLoading ? COPY.loading : COPY.idle}
      </button>
      {state.status === "ok" ? (
        state.needRestart ? (
          <div className="banner" style={{ marginTop: 8 }}>
            <Icon name="info" />
            <p className="meta">{state.message}</p>
          </div>
        ) : (
          <p className="field-hint" style={{ marginTop: 8 }}>
            {state.message}
          </p>
        )
      ) : null}
      {state.status === "error" ? (
        <p className="field-error" style={{ marginTop: 8 }}>
          <Icon name="error" size={16} />
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
