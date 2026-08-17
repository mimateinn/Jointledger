"use client";

import { useActionState, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { addMemberAction, issueInviteAction, type MemberState } from "@/app/actions/members";
import { ImportWizard } from "@/app/(app)/first-use/import-wizard";

const initial: MemberState = {};

function InviteOnce({ state }: { state: MemberState }) {
  if (!state.inviteSecret) {
    return null;
  }
  return (
    <div className="card" style={{ marginTop: 16, background: "var(--bg)" }}>
      <p className="meta muted">{state.inviteFor} 嘅邀請密鑰 · 只顯示呢一次</p>
      <p className="body tabular" style={{ wordBreak: "break-all", margin: "8px 0" }}>
        {state.inviteSecret}
      </p>
      <p className="meta muted">7 日內有效，只用一次。抄低之後離線交俾對方。呢頁再入就唔會再顯示。</p>
    </div>
  );
}

export function AccountClient({
  currentUserId,
  members,
  schedules,
}: {
  currentUserId: string;
  members: { id: string; displayName: string; email: string | null; userId: string | null }[];
  schedules: {
    effectiveOn: string;
    current: boolean;
    legs: { memberId: string; displayName: string; percent: string }[];
  }[];
}) {
  const [addState, addAction, addPending] = useActionState(addMemberAction, initial);
  const [inviteState, inviteAction, invitePending] = useActionState(issueInviteAction, initial);
  const [reimport, setReimport] = useState(false);
  const current = schedules.find((row) => row.current) ?? schedules.at(-1) ?? null;
  const shown = inviteState.inviteSecret ? inviteState : addState;

  if (reimport) {
    return <ImportWizard reimport onBack={() => setReimport(false)} />;
  }

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
              {!member.userId ? (
                <form action={inviteAction}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <button className="btn btn-ghost" type="submit" disabled={invitePending}>
                    發邀請密鑰
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
        <p className="meta muted" style={{ marginTop: 16 }}>
          加成員會發一次性邀請密鑰。對方要用顯示名或電郵 + 密鑰 + 自己設嘅密碼認領。認領只綁呢個成員，唔會開新表。
        </p>
        <InviteOnce state={shown} />
        <form className="form-grid" action={addAction} style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="displayName">顯示名</label>
            <input className="input" id="displayName" name="displayName" required />
          </div>
          <div className="field">
            <label htmlFor="email">電郵（可選）</label>
            <input className="input" id="email" name="email" type="email" />
          </div>
          {addState.error ? <p className="alert">{addState.error}</p> : null}
          {inviteState.error ? <p className="alert">{inviteState.error}</p> : null}
          {shown.ok ? <p className="ok">{shown.ok}</p> : null}
          <button className="btn btn-secondary" type="submit" disabled={addPending}>
            加成員
          </button>
        </form>
      </section>

      {current ? (
        <section className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 className="title">聯名分帳</h2>
            <span className="meta muted">{current.legs.map((leg) => leg.displayName).join(" + ")}</span>
          </div>
          <p className="body">
            自 {current.effectiveOn.replaceAll("-", "/")} ·{" "}
            {current.legs.map((leg) => `${leg.displayName} ${Number(leg.percent).toFixed(1)}%`).join(" / ")}
          </p>
          <p className="meta muted">按買入日比例·改完只影響新單</p>
          <ul className="muted" style={{ marginTop: 12 }}>
            {schedules.map((row) => (
              <li key={row.effectiveOn}>
                {row.effectiveOn.replaceAll("-", "/")}{" "}
                {row.legs.map((leg) => `${leg.displayName} ${Number(leg.percent).toFixed(1)}%`).join(" / ")}
                {row.current ? " · 而家" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card stack">
        <h2 className="title">再匯入</h2>
        <p className="muted">只寫入而家呢本記帳表。要明示追加或取代。經現有 createCashFlow／createTrade。</p>
        <button className="btn btn-secondary" type="button" onClick={() => setReimport(true)}>
          再匯入試算表
        </button>
      </section>

      <form action={logoutAction}>
        <button className="btn btn-secondary" type="submit">
          登出
        </button>
      </form>
    </div>
  );
}
