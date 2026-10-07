"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";

const COPY = {
  title: "呢頁暫時載唔到",
  body: "唔好緊，再試一次就得。如果一直都係咁，請稍後再嚟。",
  retry: "再試",
  login: "返回登入",
};

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page-center">
      <div className="card state-panel state-panel-error login-card" role="alert">
        <p className="page-eyebrow">頁面</p>
        <Icon name="warning" size={24} className="icon-24" />
        <h2>{COPY.title}</h2>
        <p>{COPY.body}</p>
        <div className="state-actions">
          <button className="btn btn-primary" type="button" onClick={reset}>
            <Icon name="refresh" size={16} />
            {COPY.retry}
          </button>
          <Link href="/login" className="btn btn-ghost">
            {COPY.login}
          </Link>
        </div>
      </div>
    </div>
  );
}
