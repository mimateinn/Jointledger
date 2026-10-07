"use client";

export const TOAST_HOST_ID = "toast-host";
export const MAX_VISIBLE_TOASTS = 2;

export function ensureToastHost(): HTMLElement {
  const existing = document.getElementById(TOAST_HOST_ID);
  if (existing) {
    return existing;
  }
  const host = document.createElement("div");
  host.id = TOAST_HOST_ID;
  host.className = "toast-host";
  host.dataset.toastHost = "";
  document.body.appendChild(host);
  return host;
}
