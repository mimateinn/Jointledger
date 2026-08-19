"use client";

import { useActionState, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { addMemberAction, issueInviteAction, type MemberState } from "@/app/actions/members";
import { ImportWizard } from "@/app/(app)/first-use/import-wizard";
import { EmptyPanel } from "@/components/empty-panel";
import { MemberDelete } from "@/components/member-delete";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdateCheckButton } from "@/components/update-check-button";
import { formatRelativeDate, formatSchedulePercent } from "@/lib/format";

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

function MemberRow({
  member,
  you,
  lastUser,
  inviteAction,
}: {
  member: { id: string; displayName: string; email: string | null; userId: string | null };
  you: boolean;
  lastUser: boolean;
  inviteAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="member-row">
      <div className={you ? "avatar" : "avatar avatar-muted"}>{member.displayName.slice(0, 1)}</div>
      <div style={{ flex: 1 }}>
        <div>
          {member.displayName}
          {you ? <span className="meta muted"> · 你</span> : null}
        </div>
        {member.email ? <div className="meta muted">{member.email}</div> : null}
      </div>
      <div className="meta muted">{member.userId ? "已登入" : "未設密碼"}</div>
      <MemberDelete memberId={member.id} displayName={member.displayName} lastUser={lastUser} />
      {!member.userId ? (
        <form action={inviteAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <SubmitButton className="btn btn-ghost" pendingLabel="發緊…">
            發邀請密鑰
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

export function AccountClient({
  currentUserId,
  members,
  schedules,
  emptyLedger,
}: {
  currentUserId: string;
  members: { id: string; displayName: string; email: string | null; userId: string | null }[];
  emptyLedger: boolean;
  schedules: {
    effectiveOn: string;
    current: boolean;
    legs: { memberId: string; displayName: string; percent: string }[];
  }[];
}) {
  const [addState, addAction] = useActionState(addMemberAction, initial);
  const [inviteState, inviteAction] = useActionState(issueInviteAction, initial);
  const [reimport, setReimport] = useState(false);
  const current = schedules.find((row) => row.current) ?? schedules.at(-1) ?? null;
  const shown = inviteState.inviteSecret ? inviteState : addState;
  const me = members.find((member) => member.userId === currentUserId) ?? null;
  const others = members.filter((member) => member.userId !== currentUserId);
  const lastUser = members.filter((row) => row.userId).length <= 1;

  if (reimport) {
    return <ImportWizard reimport onBack={() => setReimport(false)} />;
  }

  return (
    <div className="stack">
      <h1 className="title">帳戶</h1>
      {emptyLedger ? (
        <EmptyPanel sentence="未有持倉或流水，記一筆就可以開始。" actionLabel="記一筆" />
      ) : null}

      <section className="card">
        <h2 className="title">我是誰</h2>
        {me ? (
          <MemberRow member={me} you lastUser={lastUser && Boolean(me.userId)} inviteAction={inviteAction} />
        ) : (
          <p className="muted">未對上而家呢個帳戶。</p>
        )}
      </section>

      <section className="card">
        <h2 className="title">其他人</h2>
        {others.length === 0 ? <p className="muted">未有其他人。</p> : null}
        {others.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            you={false}
            lastUser={lastUser && Boolean(member.userId)}
            inviteAction={inviteAction}
          />
        ))}
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
          <SubmitButton className="btn btn-secondary" pendingLabel="加緊…">
            加成員
          </SubmitButton>
        </form>
      </section>

      {current ? (
        <section className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 className="title">聯名分帳</h2>
            <span className="meta muted">{current.legs.map((leg) => leg.displayName).join(" + ")}</span>
          </div>
          <p className="body">
            自 {formatRelativeDate(current.effectiveOn)} ·{" "}
            {current.legs.map((leg) => `${leg.displayName} ${formatSchedulePercent(leg.percent)}`).join(" / ")}
          </p>
          <p className="meta muted">按買入日比例·改完只影響新單</p>
          <ul className="muted" style={{ marginTop: 12 }}>
            {schedules.map((row) => (
              <li key={row.effectiveOn}>
                {formatRelativeDate(row.effectiveOn)}{" "}
                {row.legs.map((leg) => `${leg.displayName} ${formatSchedulePercent(leg.percent)}`).join(" / ")}
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

      <section className="card stack">
        <h2 className="title">設定</h2>
        <div className="row">
          <div>
            <div className="body">外觀</div>
            <p className="meta muted">暖紙白／炭橄欖。唔同六個導覽項搶位。</p>
          </div>
          <ThemeToggle />
        </div>
        <div className="row">
          <div>
            <div className="body">官方更新</div>
            <p className="meta muted">檢查最新官方 Release。資料同資料庫唔會消失。</p>
          </div>
          <UpdateCheckButton />
        </div>
      </section>

      <section className="card stack">
        <h2 className="title">登出</h2>
        <form action={logoutAction}>
          <SubmitButton className="btn btn-secondary" pendingLabel="登出緊…">
            登出
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
