"use client";

import { useActionState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { addMemberAction, type MemberState } from "@/app/actions/members";

const initial: MemberState = {};

export function AccountClient({
  currentUserId,
  members,
}: {
  currentUserId: string;
  members: { id: string; displayName: string; email: string | null; userId: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(addMemberAction, initial);

  return (
    <div className="stack">
      <h1 className="display">帳戶</h1>
      <section className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 className="title">成員</h2>
        </div>
        {members.map((member) => {
          const you = member.userId === currentUserId;
          return (
            <div className="member-row" key={member.id}>
              <div className={you ? "avatar" : "avatar avatar-muted"}>
                {member.displayName.slice(0, 1)}
              </div>
              <div style={{ flex: 1 }}>
                <div>
                  {member.displayName}
                  {you ? <span className="meta muted"> · 你</span> : null}
                </div>
                {member.email ? <div className="meta muted">{member.email}</div> : null}
              </div>
              <div className="meta muted">{member.userId ? "已登入" : "未設密碼"}</div>
            </div>
          );
        })}
        <p className="meta muted" style={{ marginTop: 16 }}>
          對方用顯示名或電郵自己設密碼。唔使邀請碼。
        </p>
        <form className="form-grid" action={formAction} style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="displayName">顯示名</label>
            <input className="input" id="displayName" name="displayName" required />
          </div>
          <div className="field">
            <label htmlFor="email">電郵（可選）</label>
            <input className="input" id="email" name="email" type="email" />
          </div>
          {state.error ? <p className="alert">{state.error}</p> : null}
          {state.ok ? <p className="ok">{state.ok}</p> : null}
          <button className="btn btn-secondary" type="submit" disabled={pending}>
            加成員
          </button>
        </form>
      </section>
      <form action={logoutAction}>
        <button className="btn btn-secondary" type="submit">
          登出
        </button>
      </form>
    </div>
  );
}
