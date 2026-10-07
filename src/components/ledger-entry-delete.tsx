"use client";

import { useState } from "react";
import {
  checkDeleteLedgerEntryAction,
  deleteLedgerEntryAction,
  type EntryState,
} from "@/app/actions/entry";
import { ErrorToast } from "./error-toast";
import { Icon } from "./icons";
import { UndoToast } from "./undo-toast";
import { UNDO_MS, useUndoCommit } from "./undo-commit";

const COPY = {
  delete: "刪除",
  confirmTitle: "確認刪呢筆",
  confirm: "確認刪除",
  cancel: "取消",
  checking: "檢查緊",
  failed: "刪除失敗",
  cash: "刪除後，呢筆出入金會消失，現金會按不變式重計。",
  trade: "刪除後，呢筆記帳列會消失。相關持倉同現金會按剩餘列重計。若之後仲有呢隻嘅賣出／拆股／調整，要先刪或處理嗰啲。",
};

export type LedgerDeleteFn = (prev: EntryState, formData: FormData) => Promise<EntryState>;

function deleteFormData(id: string, kind: "cash" | "trade"): FormData {
  const fd = new FormData();
  fd.set("entryId", id);
  fd.set("kind", kind);
  fd.set("confirm", "1");
  return fd;
}

export function LedgerEntryDelete({
  id,
  kind,
  label,
  checkDelete = checkDeleteLedgerEntryAction,
  deleteAction = deleteLedgerEntryAction,
  undoMs = UNDO_MS,
}: {
  id: string;
  kind: "cash" | "trade";
  label: string;
  checkDelete?: LedgerDeleteFn;
  deleteAction?: LedgerDeleteFn;
  undoMs?: number;
}) {
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [committing, setCommitting] = useState(false);

  const { phase, setPhase } = useUndoCommit(undoMs, () => {
    void commitDelete();
  });

  async function commitDelete() {
    setCommitting(true);
    try {
      const result = await deleteAction({}, deleteFormData(id, kind));
      if (result.error) {
        setPhase("idle");
        setRejectError(result.error);
      }
    } catch (error) {
      setPhase("idle");
      setRejectError(error instanceof Error ? error.message : COPY.failed);
    } finally {
      setCommitting(false);
    }
  }

  async function onConfirm() {
    setChecking(true);
    setRejectError(null);
    try {
      const result = await checkDelete({}, deleteFormData(id, kind));
      if (result.error) {
        setPhase("idle");
        setRejectError(result.error);
        return;
      }
      setPhase("undo");
    } catch (error) {
      setPhase("idle");
      setRejectError(error instanceof Error ? error.message : COPY.failed);
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

      {phase === "undo" ? <UndoToast onUndo={() => setPhase("idle")} pending={committing} label={label} /> : null}

      {rejectError ? <ErrorToast message={rejectError} label={label} onDismiss={() => setRejectError(null)} /> : null}
    </>
  );
}
