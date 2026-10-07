"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

const STORAGE_KEY = "joint-ledger.tips.v1";

const COPY = {
  title: "三步開始",
  dismiss: "知道了",
  tips: [
    { icon: "coin-usd" as const, title: "先入金", body: "喺記一筆記入現金，先有可用資金。" },
    { icon: "entry" as const, title: "再記持股", body: "用買入記已有倉位。記帳唔係下單。" },
    { icon: "ledger" as const, title: "流水可改", body: "記錯可以喺流水刪除，幾秒內可還原。" },
  ],
};

export function FirstRunTips() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) {
    return null;
  }

  return (
    <section className="card is-entering" aria-label={COPY.title}>
      <div className="card-head">
        <h2 className="card-title">{COPY.title}</h2>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              /* ignore quota */
            }
            setOpen(false);
          }}
        >
          {COPY.dismiss}
        </button>
      </div>
      <ol className="tips-list">
        {COPY.tips.map((tip) => (
          <li key={tip.title}>
            <Icon name={tip.icon} size={20} />
            <div>
              <div className="body">{tip.title}</div>
              <p className="meta muted">{tip.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
