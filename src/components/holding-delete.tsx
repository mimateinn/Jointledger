"use client";

import { useActionState, useState } from "react";
import { deleteHoldingAction, type EntryState } from "@/app/actions/entry";
import { SubmitButton } from "./submit-button";

const initial: EntryState = {};

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
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteHoldingAction, initial);

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
      aria-label="確認刪持倉"
      onClick={(event) => event.stopPropagation()}
    >
      <input type="hidden" name="tradeId" value={tradeId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="confirm" value="1" />
      <p className="body">
        確認刪{closed ? "已平倉" : "持倉"} {symbol}？呢係更正，現金會按不變式重算。
      </p>
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
