"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { ensureToastHost } from "./toast-host";

export const UNDO_TOAST_COPY = "已刪除・還原";

export function UndoToast({
  onUndo,
  pending = false,
  label,
}: {
  onUndo: () => void;
  pending?: boolean;
  label?: string;
}) {
  const [host, setHost] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : ensureToastHost(),
  );
  useEffect(() => {
    setHost(ensureToastHost());
  }, []);

  const body = (
    <div className="toast" role="status" aria-live="polite" data-undo-toast="" data-undo-label={label ?? ""}>
      <Icon name="undo" />
      <span>{UNDO_TOAST_COPY}</span>
      {label ? <span className="toast-label">{label}</span> : null}
      <button
        className="btn btn-secondary"
        type="button"
        onClick={onUndo}
        disabled={pending}
        aria-label={label ? `還原 ${label}` : "還原"}
      >
        還原
      </button>
    </div>
  );

  if (!host) {
    return null;
  }
  return createPortal(body, host);
}
