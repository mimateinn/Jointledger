"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { ensureToastHost } from "./toast-host";

export const ERROR_TOAST_MS = 8000;

export function ErrorToast({
  message,
  label,
  onDismiss,
}: {
  message: string;
  label?: string;
  onDismiss?: () => void;
}) {
  const [host, setHost] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : ensureToastHost(),
  );
  useEffect(() => {
    setHost(ensureToastHost());
  }, []);

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    if (!onDismissRef.current) {
      return;
    }
    const timer = window.setTimeout(() => onDismissRef.current?.(), ERROR_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const body = (
    <div className="toast toast-error" role="alert" data-error-toast="">
      <Icon name="error" />
      <span>{message}</span>
      {label ? <span className="toast-label">{label}</span> : null}
      {onDismiss ? (
        <button className="btn btn-ghost btn-icon" type="button" aria-label="關閉" onClick={onDismiss}>
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );

  if (!host) {
    return null;
  }
  return createPortal(body, host);
}
