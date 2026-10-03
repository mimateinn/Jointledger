"use client";

import { useState } from "react";
import { Icon } from "./icons";

const COPY = {
  show: "顯示密碼",
  hide: "隱藏密碼",
};

export function PasswordField({
  id,
  name,
  autoComplete,
  label,
  required = true,
  minLength = 8,
}: {
  id: string;
  name: string;
  autoComplete: string;
  label: string;
  required?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          className="input"
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-pressed={visible}
          aria-label={visible ? COPY.hide : COPY.show}
          onClick={() => setVisible((v) => !v)}
        >
          <Icon name={visible ? "eye-off" : "eye"} />
        </button>
      </div>
    </div>
  );
}
