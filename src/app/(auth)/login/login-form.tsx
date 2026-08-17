"use client";

import { useActionState, useState } from "react";
import { claimAction, loginAction, registerAction, type AuthState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";

const initial: AuthState = {};

export function LoginForm({ emptySystem }: { emptySystem: boolean }) {
  const [mode, setMode] = useState<"login" | "claim">("login");
  const action = emptySystem ? registerAction : mode === "claim" ? claimAction : loginAction;
  const [state, formAction] = useActionState(action, initial);

  return (
    <div className="page-center">
      <form className="card login-card" action={formAction} key={emptySystem ? "register" : mode}>
        <div className="row">
          <div className="display">聯倉</div>
          <ThemeToggle />
        </div>
        <p className="muted">密碼只保護呢本記帳。唔會連接任何券商或股票戶口。</p>

        {emptySystem ? (
          <>
            <div className="field">
              <label htmlFor="displayName">顯示名</label>
              <input className="input" id="displayName" name="displayName" required autoComplete="username" />
            </div>
            <div className="field">
              <label htmlFor="email">電郵（可選）</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" />
            </div>
          </>
        ) : (
          <>
            <div className="tabs-line">
              <button
                className={mode === "login" ? "tab tab-active" : "tab"}
                type="button"
                onClick={() => setMode("login")}
              >
                登入
              </button>
              <button
                className={mode === "claim" ? "tab tab-active" : "tab"}
                type="button"
                onClick={() => setMode("claim")}
              >
                認領成員
              </button>
            </div>
            <div className="field">
              <label htmlFor="identifier">{mode === "claim" ? "顯示名或電郵" : "電郵或顯示名"}</label>
              <input className="input" id="identifier" name="identifier" required autoComplete="username" />
            </div>
            {mode === "claim" ? (
              <div className="field">
                <label htmlFor="inviteSecret">邀請密鑰</label>
                <input
                  className="input"
                  id="inviteSecret"
                  name="inviteSecret"
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ) : null}
          </>
        )}

        <div className="field">
          <label htmlFor="password">密碼 · 至少 8 個字</label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={emptySystem || mode === "claim" ? "new-password" : "current-password"}
          />
        </div>

        {state.error ? <p className="alert">{state.error}</p> : null}

        <SubmitButton
          className="btn btn-primary btn-block"
          pendingLabel={emptySystem ? "建立緊…" : mode === "claim" ? "認領緊…" : "登入緊…"}
        >
          {emptySystem ? "建立帳戶" : mode === "claim" ? "認領並設密碼" : "登入"}
        </SubmitButton>
        {emptySystem ? null : mode === "claim" ? (
          <p className="footer-note">顯示名或電郵只係認人。一定要有對方抄俾你嘅一次性邀請密鑰。唔會開新表。</p>
        ) : (
          <p className="footer-note">呢度唔能夠自己註冊。要等而家用緊嘅人加你，再嚟認領。</p>
        )}
        <p className="footer-note">記帳唔係下單。唔會連接任何券商。</p>
      </form>
    </div>
  );
}
