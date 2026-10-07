"use client";

import { useActionState, useState } from "react";
import { changePasswordAction, logoutAction, type AuthState } from "@/app/actions/auth";
import { addMemberAction, issueInviteAction, type MemberState } from "@/app/actions/members";
import { ImportWizard } from "@/app/(app)/first-use/import-wizard";
import { EmptyPanel } from "@/components/empty-panel";
import { Icon } from "@/components/icons";
import { MemberDelete } from "@/components/member-delete";
import { PasswordField } from "@/components/password-field";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdateCheckButton } from "@/components/update-check-button";
import { formatRelativeDate, formatSchedulePercent } from "@/lib/format";

const COPY = {
  eyebrow: "設定",
  title: "帳戶",
  me: "我是誰",
  others: "其他人",
  none: "未有其他人。",
  add: "加成員",
  displayName: "顯示名",
  email: "電郵（可選）",
  inviteHint: "認領只綁呢個成員，唔會開新表。",
  joint: "聯名分帳",
  export: "資料",
  exportHelp: "下載而家呢本記帳表。預設開新檔，名為「聯倉」加日期；唔會改到你而家用緊嘅表。",
  download: "下載試算表",
  reimport: "再匯入",
  reimportHelp: "把試算表寫返入而家呢本記帳。要先揀追加定取代，確認之後先會改資料。",
  startImport: "再匯入試算表",
  settings: "設定",
  look: "外觀",
  lookHelp: "暖紙／夜頁，或者跟系統。唔同六個導覽項搶位。",
  update: "官方更新",
  updateHelp: "檢查最新官方版本。資料同資料庫唔會消失。",
  password: "改密碼",
  logout: "登出",
  empty: "未有持倉或流水 · 記一筆",
  you: "你",
  in: "已登入",
  out: "未設密碼",
};

const initial: MemberState = {};
const passwordInitial: AuthState = {};

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
  member: { id: string; displayName: string; userId: string | null };
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
          {you ? <span className="chip" style={{ marginLeft: 8 }}>{COPY.you}</span> : null}
        </div>
        <div className="meta muted">
          <span className={member.userId ? "status-dot" : "status-dot status-dot-empty"} />{" "}
          {member.userId ? COPY.in : COPY.out}
        </div>
      </div>
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
  members: { id: string; displayName: string; userId: string | null }[];
  emptyLedger: boolean;
  schedules: {
    effectiveOn: string;
    current: boolean;
    legs: { memberId: string; displayName: string; percent: string }[];
  }[];
}) {
  const [addState, addAction] = useActionState(addMemberAction, initial);
  const [inviteState, inviteAction] = useActionState(issueInviteAction, initial);
  const [passwordState, passwordAction] = useActionState(changePasswordAction, passwordInitial);
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
    <div className="page">
      <div className="page-head">
        <div className="page-head-title">
          <p className="page-eyebrow">{COPY.eyebrow}</p>
          <h1 className="page-title">{COPY.title}</h1>
        </div>
      </div>
      {emptyLedger ? (
        <div className="banner">
          <Icon name="info" />
          {COPY.empty}
        </div>
      ) : null}

      <div className="grid-12 account-grid">
        <div className="col-7 stack">
          <section className="card">
            <h2 className="card-title">{COPY.me}</h2>
            {me ? (
              <MemberRow member={me} you lastUser={lastUser && Boolean(me.userId)} inviteAction={inviteAction} />
            ) : (
              <p className="muted">未對上而家呢個帳戶。</p>
            )}
            <h2 className="card-title" style={{ marginTop: 16 }}>{COPY.others}</h2>
            {others.length === 0 ? <p className="muted">{COPY.none}</p> : null}
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
            <details style={{ marginTop: 16 }}>
              <summary className="btn btn-secondary">
                <Icon name="member-add" size={16} />
                {COPY.add}
              </summary>
              <form className="form-grid" action={addAction} style={{ marginTop: 16 }}>
                <div className="field">
                  <label htmlFor="displayName">{COPY.displayName}</label>
                  <input className="input" id="displayName" name="displayName" required />
                </div>
                <div className="field">
                  <label htmlFor="email">{COPY.email}</label>
                  <input className="input" id="email" name="email" type="email" />
                </div>
                {addState.error ? <p className="field-error">{addState.error}</p> : null}
                {inviteState.error ? <p className="field-error">{inviteState.error}</p> : null}
                {shown.ok ? <p className="ok">{shown.ok}</p> : null}
                <SubmitButton className="btn btn-secondary" pendingLabel="加緊…">
                  {COPY.add}
                </SubmitButton>
              </form>
            </details>
          </section>

          {current ? (
            <section className="card">
              <div className="row" style={{ marginBottom: 8 }}>
                <h2 className="card-title">{COPY.joint}</h2>
                <span className="meta muted">{current.legs.map((leg) => leg.displayName).join(" + ")}</span>
              </div>
              <div className="joint-bar" aria-hidden>
                {current.legs.map((leg) => (
                  <span key={leg.memberId} style={{ width: `${Number(leg.percent) * 100}%` }} />
                ))}
              </div>
              <p className="body" style={{ marginTop: 8 }}>
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
          ) : (
            <section className="card">
              <h2 className="card-title">{COPY.joint}</h2>
              <p className="muted">尚未設立聯名</p>
            </section>
          )}
        </div>

        <div className="col-5 stack">
          <section className="card stack">
            <h2 className="card-title">{COPY.export}</h2>
            <p className="muted">{COPY.exportHelp}</p>
            <a className="btn btn-secondary" href="/api/export" download="book-export.xlsx">
              <Icon name="download" size={16} />
              {COPY.download}
            </a>
            <p className="muted">{COPY.reimportHelp}</p>
            <button className="btn btn-secondary" type="button" onClick={() => setReimport(true)}>
              <Icon name="upload-import" size={16} />
              {COPY.startImport}
            </button>
          </section>

          <section className="card stack">
            <h2 className="card-title">{COPY.settings}</h2>
            <div className="row">
              <div>
                <div className="body">{COPY.look}</div>
                <p className="meta muted">{COPY.lookHelp}</p>
              </div>
              <ThemeToggle />
            </div>
            <div className="row">
              <div>
                <div className="body">{COPY.update}</div>
                <p className="meta muted">{COPY.updateHelp}</p>
              </div>
              <UpdateCheckButton />
            </div>
          </section>

          <section className="card stack">
            <h2 className="card-title">{COPY.password}</h2>
            <form className="form-grid" action={passwordAction}>
              <PasswordField id="currentPassword" name="currentPassword" label="而家嘅密碼" autoComplete="current-password" />
              <PasswordField id="newPassword" name="newPassword" label="新密碼 · 至少 8 個字" autoComplete="new-password" />
              <PasswordField id="confirmPassword" name="confirmPassword" label="再輸入新密碼" autoComplete="new-password" />
              {passwordState.error ? <p className="field-error">{passwordState.error}</p> : null}
              {passwordState.ok ? <p className="ok">{passwordState.ok}</p> : null}
              <SubmitButton className="btn btn-secondary" pendingLabel="改緊…">
                {COPY.password}
              </SubmitButton>
            </form>
          </section>

          <section className="card stack">
            <h2 className="card-title">{COPY.logout}</h2>
            <form action={logoutAction}>
              <SubmitButton className="btn btn-danger" pendingLabel="登出緊…">
                <Icon name="logout" size={16} />
                {COPY.logout}
              </SubmitButton>
            </form>
          </section>
        </div>
      </div>
      {emptyLedger ? <EmptyPanel sentence="未有持倉或流水，記一筆就可以開始。" actionLabel="記一筆" /> : null}
    </div>
  );
}
