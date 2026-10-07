"use client";

import { useActionState, useEffect, useRef, useState, type RefObject } from "react";
import { useFormStatus } from "react-dom";
import {
  checkDeleteLedgerEntryAction,
  deleteLedgerEntryAction,
  type EntryState,
} from "@/app/actions/entry";
import { ErrorToast } from "./error-toast";
import { Icon } from "./icons";
import { SubmitButton } from "./submit-button";
import { UndoToast } from "./undo-toast";
import { useUndoCommit } from "./undo-commit";

const COPY = {
  delete: "刪除",
  confirmTitle: "確認刪呢筆",
  confirm: "確認刪除",
  cancel: "取消",
  undo: "還原",
  pending: "儲存中",
  checking: "檢查緊",
  cash: "刪除後，呢筆出入金會消失，現金會按不變式重計。",
  trade: "刪除後，呢筆記帳列會消失。相關持倉同現金會按剩餘列重計。若之後仲有呢隻嘅賣出／拆股／調整，要先刪或處理嗰啲。",
  wait: "幾秒後會刪除呢筆記錄。還原就唔刪。",
};

const initial: EntryState = {};

export type LedgerDeleteFn = (prev: EntryState, formData: FormData) => Promise<EntryState>;

function UndoFields({ onUndo, label }: { onUndo: () => void; label: string }) {
  const { pending } = useFormStatus();
  return <UndoToast onUndo={onUndo} pending={pending} label={label} />;
}

function DeleteCommitForm({
  formRef,
  id,
  kind,
  label,
  deleteAction,
  onUndo,
  onReject,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  id: string;
  kind: "cash" | "trade";
  label: string;
  deleteAction: LedgerDeleteFn;
  onUndo: () => void;
  onReject: (error: string) => void;
}) {
  const [state, action] = useActionState(deleteAction, initial);
  const rejectRef = useRef(onReject);
  rejectRef.current = onReject;

  useEffect(() => {
    if (state.error) {
      rejectRef.current(state.error);
    }
  }, [state.error]);

  return (
    <form ref={formRef} action={action} hidden>
      <input type="hidden" name="entryId" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="confirm" value="1" />
      <UndoFields onUndo={onUndo} label={label} />
      <span hidden>
        <SubmitButton className="btn btn-danger" pendingLabel={COPY.pending}>
          {COPY.confirm}
        </SubmitButton>
      </span>
    </form>
  );
}

export function LedgerEntryDelete({
  id,
  kind,
  label,
  checkDelete = checkDeleteLedgerEntryAction,
  deleteAction = deleteLedgerEntryAction,
  undoMs,
}: {
  id: string;
  kind: "cash" | "trade";
  label: string;
  checkDelete?: LedgerDeleteFn;
  deleteAction?: LedgerDeleteFn;
  undoMs?: number;
}) {
  const { phase, setPhase, formRef } = useUndoCommit(undoMs);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function onConfirm() {
    setChecking(true);
    setRejectError(null);
    try {
      const fd = new FormData();
      fd.set("entryId", id);
      fd.set("kind", kind);
      fd.set("confirm", "1");
      const result = await checkDelete({}, fd);
      if (result.error) {
        setPhase("idle");
        setRejectError(result.error);
        return;
      }
      setPhase("undo");
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      {phase === "idle" ? (
        <button className="btn btn-ghost btn-icon" type="button" aria-label={`${COPY.delete} ${label}`} onClick={() => setPhase("confirm")}>
          <Icon name="delete-trash" size={16} />
        </button>
      ) : null}

      {phase === "confirm" ? (
        <div className="card stack confirm-dialog" role="dialog" aria-modal="true" aria-label={COPY.confirmTitle}>
          <p className="body">{kind === "cash" ? COPY.cash : COPY.trade}</p>
          <div className="submit-row">
            <button className="btn btn-danger" type="button" disabled={checking} onClick={() => void onConfirm()}>
              {checking ? COPY.checking : COPY.confirm}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setPhase("idle")} disabled={checking}>
              {COPY.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "undo" ? (
        <DeleteCommitForm
          key={`${id}-undo`}
          formRef={formRef}
          id={id}
          kind={kind}
          label={label}
          deleteAction={deleteAction}
          onUndo={() => setPhase("idle")}
          onReject={(error) => {
            setPhase("idle");
            setRejectError(error);
          }}
        />
      ) : null}

      {rejectError ? <ErrorToast message={rejectError} label={label} /> : null}
    </>
  );
}
