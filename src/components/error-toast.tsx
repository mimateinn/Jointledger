"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { ensureToastHost } from "./toast-host";

export function ErrorToast({
  message,
  label,
}: {
  message: string;
  label?: string;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(ensureToastHost());
  }, []);

  const body = (
    <div className="toast toast-error" role="alert" data-error-toast="">
      <Icon name="error" />
      <span>{message}</span>
      {label ? <span className="toast-label">{label}</span> : null}
    </div>
  );

  if (!host) {
    return null;
  }
  return createPortal(body, host);
}
