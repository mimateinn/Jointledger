"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

export const UNDO_TOAST_COPY = "已刪除・還原";

export function UndoToast({
  onUndo,
  pending = false,
}: {
  onUndo: () => void;
  pending?: boolean;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  const body = (
    <div className="toast" role="status" aria-live="polite" data-undo-toast="">
      <Icon name="undo" />
      <span>{UNDO_TOAST_COPY}</span>
      <button className="btn btn-secondary" type="button" onClick={onUndo} disabled={pending}>
        還原
      </button>
    </div>
  );

  if (!ready) {
    return null;
  }
  return createPortal(body, document.body);
}
