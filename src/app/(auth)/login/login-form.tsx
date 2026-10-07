"use client";

import { useActionState, useState } from "react";
import { claimAction, loginAction, registerAction, type AuthState } from "@/app/actions/auth";
import { PasswordField } from "@/components/password-field";
import { SubmitButton } from "@/components/submit-button";

const COPY = {
  brand: "聯倉",
  tag: "多人股票記帳",
  login: "登入",
  claim: "認領成員",
  create: "建立帳戶",
  identifier: "電郵或顯示名",
  claimId: "顯示名或電郵",
  displayName: "顯示名",
  email: "電郵（可選）",
  password: "密碼 · 至少 8 個字",
  invite: "邀請密鑰",
  noSelf: "呢度唔能夠自己註冊。要等而家用緊嘅人加你，再嚟認領。",
  claimHint: "顯示名或電郵只係認人。一定要有對方抄俾你嘅一次性邀請密鑰。唔會開新表。",
  first: "第一位會成為建立者，之後可以加成員。",
  outside: "密碼只保護呢本記帳。唔會連接任何券商或股票戶口。",
  claimSubmit: "認領並設密碼",
};

const initial: AuthState = {};

export function LoginForm({ emptySystem }: { emptySystem: boolean }) {
  const [mode, setMode] = useState<"login" | "claim">("login");
  const action = emptySystem ? registerAction : mode === "claim" ? claimAction : loginAction;
  const [state, formAction] = useActionState(action, initial);

  return (
    <div className="page-center page-center-login">
      <div className="login-wordmark">
        <p className="page-eyebrow">登入</p>
        <div className="title">{COPY.brand}</div>
        <p className="meta muted">{COPY.tag}</p>
      </div>
      <form className="card login-card" action={formAction} key={emptySystem ? "register" : mode}>
        {emptySystem ? (
          <h1 className="title">{COPY.create}</h1>
        ) : (
          <div className="tabs-line has-indicator">
            <button className={mode === "login" ? "tab tab-active" : "tab"} type="button" onClick={() => setMode("login")}>
              {COPY.login}
            </button>
            <button className={mode === "claim" ? "tab tab-active" : "tab"} type="button" onClick={() => setMode("claim")}>
              {COPY.claim}
            </button>
          </div>
        )}

        {emptySystem ? (
          <>
            <div className="field">
              <label htmlFor="displayName">{COPY.displayName}</label>
              <input className="input" id="displayName" name="displayName" required autoComplete="username" />
            </div>
            <div className="field">
              <label htmlFor="email">{COPY.email}</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" />
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="identifier">{mode === "claim" ? COPY.claimId : COPY.identifier}</label>
              <input className="input" id="identifier" name="identifier" required autoComplete="username" />
            </div>
            {mode === "claim" ? (
              <div className="field">
                <label htmlFor="inviteSecret">{COPY.invite}</label>
                <input
                  className="input tabular"
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

        <PasswordField
          id="password"
          name="password"
          label={COPY.password}
          autoComplete={emptySystem || mode === "claim" ? "new-password" : "current-password"}
        />

        {state.error ? (
          <p className="field-error" role="alert">
            {state.error}
          </p>
        ) : null}

        <SubmitButton className="btn btn-primary btn-block" pendingLabel="儲存中">
          {emptySystem ? COPY.create : mode === "claim" ? COPY.claimSubmit : COPY.login}
        </SubmitButton>
        {emptySystem ? <p className="meta muted">{COPY.first}</p> : null}
        {emptySystem ? null : mode === "claim" ? (
          <p className="meta muted">{COPY.claimHint}</p>
        ) : (
          <p className="meta muted">{COPY.noSelf}</p>
        )}
      </form>
      <p className="footer-note footer-note-center" style={{ marginTop: 16 }}>
        {COPY.outside}
      </p>
    </div>
  );
}
