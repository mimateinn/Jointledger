"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteHoldingAction, type EntryState } from "@/app/actions/entry";
import { SubmitButton } from "./submit-button";
import { useUndoCommit } from "./undo-commit";

const initial: EntryState = {};

function UndoBanner({ onUndo }: { onUndo: () => void }) {
  const { pending } = useFormStatus();
  if (pending) {
    return <p className="meta">儲存中</p>;
  }
  return (
    <div className="stack">
      <p className="body">幾秒後會刪除這筆持倉同相關賣出。還原就唔刪。</p>
      <button className="btn btn-secondary" type="button" onClick={onUndo}>
        還原
      </button>
    </div>
  );
}

export function HoldingDelete({
  tradeId,
  memberId,
  symbol,
  closed,
}: {
  tradeId: string;
  memberId: string;
  symbol: string;
  closed?: boolean;
}) {
  const { phase, setPhase, formRef } = useUndoCommit();
  const [state, action] = useActionState(deleteHoldingAction, initial);

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
        aria-label="確認刪持倉"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="body">
          刪除後，這筆{closed ? "已平倉" : "持倉"} {symbol}{" "}
          同相關賣出會一齊消失，現金會按不變式重計。
        </p>
        <div className="submit-row">
          <button className="btn btn-danger" type="button" onClick={() => setPhase("undo")}>
            確認刪除
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => setPhase("idle")}>
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="card stack confirm-dialog"
      onClick={(event) => event.stopPropagation()}
    >
      <input type="hidden" name="tradeId" value={tradeId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="confirm" value="1" />
      {state.error ? <p className="alert">{state.error}</p> : null}
      <UndoBanner onUndo={() => setPhase("idle")} />
      <span hidden>
        <SubmitButton className="btn btn-danger" pendingLabel="儲存中">
          確認刪除
        </SubmitButton>
      </span>
    </form>
  );
}
