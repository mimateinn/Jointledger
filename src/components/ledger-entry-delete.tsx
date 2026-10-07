"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteLedgerEntryAction, type EntryState } from "@/app/actions/entry";
import { Icon } from "./icons";
import { SubmitButton } from "./submit-button";
import { useUndoCommit } from "./undo-commit";

const COPY = {
  delete: "刪除",
  confirmTitle: "確認刪呢筆",
  confirm: "確認刪除",
  cancel: "取消",
  undo: "還原",
  pending: "儲存中",
  cash: "刪除後，呢筆出入金會消失，現金會按不變式重計。",
  trade: "刪除後，呢筆記帳列會消失。相關持倉同現金會按剩餘列重計。若之後仲有呢隻嘅賣出／拆股／調整，要先刪或處理嗰啲。",
  wait: "幾秒後會刪除呢筆記錄。還原就唔刪。",
};

const initial: EntryState = {};

function UndoBanner({ onUndo }: { onUndo: () => void }) {
  const { pending } = useFormStatus();
  if (pending) {
    return <p className="meta">{COPY.pending}</p>;
  }
  return (
    <div className="stack">
      <p className="body">{COPY.wait}</p>
      <button className="btn btn-secondary" type="button" onClick={onUndo}>
        {COPY.undo}
      </button>
    </div>
  );
}

export function LedgerEntryDelete({
  id,
  kind,
  label,
}: {
  id: string;
  kind: "cash" | "trade";
  label: string;
}) {
  const { phase, setPhase, formRef } = useUndoCommit();
  const [state, action] = useActionState(deleteLedgerEntryAction, initial);

  if (phase === "idle") {
    return (
      <button className="btn btn-ghost btn-icon" type="button" aria-label={`${COPY.delete} ${label}`} onClick={() => setPhase("confirm")}>
        <Icon name="delete-trash" size={16} />
      </button>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="card stack confirm-dialog" role="dialog" aria-modal="true" aria-label={COPY.confirmTitle}>
        <p className="body">{kind === "cash" ? COPY.cash : COPY.trade}</p>
        <div className="submit-row">
          <button className="btn btn-danger" type="button" onClick={() => setPhase("undo")}>
            {COPY.confirm}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => setPhase("idle")}>
            {COPY.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="card stack confirm-dialog">
      <input type="hidden" name="entryId" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="confirm" value="1" />
      {state.error ? <p className="alert">{state.error}</p> : null}
      <UndoBanner onUndo={() => setPhase("idle")} />
      <span hidden>
        <SubmitButton className="btn btn-danger" pendingLabel={COPY.pending}>
          {COPY.confirm}
        </SubmitButton>
      </span>
    </form>
  );
}
