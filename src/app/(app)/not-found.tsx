import Link from "next/link";
import { Icon } from "@/components/icons";

const COPY = {
  title: "搵唔到呢頁",
  body: "網址可能打錯咗。",
  home: "返回總覽",
};

export default function AppNotFound() {
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-title">
          <p className="page-eyebrow">頁面</p>
          <h1 className="page-title">{COPY.title}</h1>
        </div>
      </div>
      <section className="card state-panel state-panel-error" role="alert" style={{ maxWidth: "var(--reading-max)" }}>
        <Icon name="warning" size={24} className="icon-24" />
        <h2>{COPY.title}</h2>
        <p>{COPY.body}</p>
        <div className="state-actions">
          <Link href="/overview" className="btn btn-primary">
            {COPY.home}
          </Link>
        </div>
      </section>
    </div>
  );
}
