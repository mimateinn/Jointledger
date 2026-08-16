"use client";

import { useActionState } from "react";
import { loginAction, registerAction, type AuthState } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const initial: AuthState = {};

export function LoginForm({ emptySystem }: { emptySystem: boolean }) {
  const action = emptySystem ? registerAction : loginAction;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <div className="page-center">
      <form className="card login-card" action={formAction}>
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
          <div className="field">
            <label htmlFor="identifier">電郵或顯示名</label>
            <input className="input" id="identifier" name="identifier" required autoComplete="username" />
          </div>
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
            autoComplete={emptySystem ? "new-password" : "current-password"}
          />
        </div>

        {state.error ? <p className="alert">{state.error}</p> : null}

        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
          {emptySystem ? "建立帳戶" : "登入"}
        </button>
        {emptySystem ? null : (
          <p className="footer-note">呢度唔能夠自己註冊。要等而家用緊嘅人加你。</p>
        )}
        <p className="footer-note">記帳唔係下單。唔會連接任何券商。</p>
      </form>
    </div>
  );
}
