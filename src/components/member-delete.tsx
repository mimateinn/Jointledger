"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteMemberAction, type MemberState } from "@/app/actions/members";
import { SubmitButton } from "./submit-button";
import { useUndoCommit } from "./undo-commit";

const initial: MemberState = {};

function UndoBanner({ onUndo }: { onUndo: () => void }) {
  const { pending } = useFormStatus();
  if (pending) {
    return <p className="meta">儲存中</p>;
  }
  return (
    <div className="stack">
      <p className="body">幾秒後會刪除這個人嘅持倉同流水。還原就唔刪。</p>
      <button className="btn btn-secondary" type="button" onClick={onUndo}>
        還原
      </button>
    </div>
  );
}

export function MemberDelete({
  memberId,
  displayName,
  lastUser,
}: {
  memberId: string;
  displayName: string;
  lastUser: boolean;
}) {
  const { phase, setPhase, formRef } = useUndoCommit();
  const [state, action] = useActionState(deleteMemberAction, initial);
  const [typed, setTyped] = useState("");

  if (phase === "idle") {
    return (
      <button className="btn btn-ghost" type="button" onClick={() => setPhase("confirm")}>
        刪除
      </button>
    );
  }

  if (phase === "confirm") {
    return (
      <div
        className="card stack confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="確認刪成員"
        style={{ minWidth: 220 }}
      >
        <p className="body">
          刪除後，這個人嘅持倉同流水會一齊消失。
          {lastUser ? "若係最後一個帳戶，會退出並要重新建立。" : ""}
          打齊顯示名確認。
        </p>
        <div className="field">
          <label htmlFor={`confirm-${memberId}`}>顯示名</label>
          <input
            className="input"
            id={`confirm-${memberId}`}
            required
            placeholder={displayName}
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        {state.error ? <p className="alert">{state.error}</p> : null}
        <div className="submit-row">
          <button
            className="btn btn-danger"
            type="button"
            disabled={typed !== displayName}
            onClick={() => {
              if (typed === displayName) {
                setPhase("undo");
              }
            }}
          >
            確認刪除
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setTyped("");
              setPhase("idle");
            }}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="card stack confirm-dialog" style={{ minWidth: 220 }}>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="confirmName" value={typed} />
      {state.error ? <p className="alert">{state.error}</p> : null}
      <UndoBanner onUndo={() => setPhase("confirm")} />
      <span hidden>
        <SubmitButton className="btn btn-danger" pendingLabel="儲存中">
          確認刪除
        </SubmitButton>
      </span>
    </form>
  );
}
