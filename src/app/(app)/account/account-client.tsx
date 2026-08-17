"use client";

import { useActionState, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { addMemberAction, type MemberState } from "@/app/actions/members";
import { ImportWizard } from "@/app/(app)/first-use/import-wizard";

const initial: MemberState = {};

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
  const [state, formAction, pending] = useActionState(addMemberAction, initial);
  const [reimport, setReimport] = useState(false);
  const current = schedules.find((row) => row.current) ?? schedules.at(-1) ?? null;

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
            </div>
          );
        })}
        <p className="meta muted" style={{ marginTop: 16 }}>
          對方用顯示名或電郵自己設密碼。唔使邀請碼。認領只綁現有成員，唔會開新表。
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
