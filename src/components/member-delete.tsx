"use client";

import { useActionState, useState } from "react";
import { deleteMemberAction, type MemberState } from "@/app/actions/members";
import { SubmitButton } from "./submit-button";

const initial: MemberState = {};

export function MemberDelete({
  memberId,
  displayName,
  lastUser,
}: {
  memberId: string;
  displayName: string;
  lastUser: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteMemberAction, initial);

  if (!open) {
    return (
      <button className="btn btn-ghost" type="button" onClick={() => setOpen(true)}>
        刪除
      </button>
    );
  }

  return (
    <form
      action={action}
      className="card stack confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="確認刪成員"
      style={{ minWidth: 220 }}
    >
      <input type="hidden" name="memberId" value={memberId} />
      <p className="body">
        {lastUser
          ? "刪最後一個用戶之後會返去建立帳戶。打齊顯示名確認。"
          : "打齊顯示名確認刪除。唔會靜默刪。"}
      </p>
      <div className="field">
        <label htmlFor={`confirm-${memberId}`}>顯示名</label>
        <input
          className="input"
          id={`confirm-${memberId}`}
          name="confirmName"
          required
          placeholder={displayName}
          autoComplete="off"
        />
      </div>
      {state.error ? <p className="alert">{state.error}</p> : null}
      <div className="submit-row">
        <SubmitButton className="btn btn-danger" pendingLabel="刪緊…">
          確認刪除
        </SubmitButton>
        <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>
          取消
        </button>
      </div>
    </form>
  );
}