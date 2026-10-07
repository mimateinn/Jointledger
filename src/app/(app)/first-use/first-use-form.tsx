"use client";

import { useActionState, useState } from "react";
import { createBookAction, type BookState } from "@/app/actions/book";
import { SubmitButton } from "@/components/submit-button";
import { ImportWizard } from "./import-wizard";

const COPY = {
  eyebrow: "開始",
  title: "你要點開始？",
  lead: "呢度只係記帳。唔會開券商戶口，亦唔會下單。",
  first: "先做呢步",
  later: "稍後先做",
  newBook: "開張新記帳表",
  newHelp: "由零開始。之後由而家嘅人加成員。而家未開放自己註冊。",
  name: "記帳表名稱",
  fx: "買賣貨幣 USD · 入金貨幣 HKD",
  open: "開新表",
  importTitle: "匯入而家用緊嘅試算表",
  importHelp: "把而家用緊嘅試算表搬過嚟。預覽成員、買賣、出入金；對唔上嘅列會單獨標出，確認持股先寫入。",
  startImport: "開始匯入",
  footer: "記帳唔係下單。密碼只保護呢本記帳，唔會連接任何券商或股票戶口。",
};

const initial: BookState = {};

export function FirstUseForm() {
  const [state, formAction] = useActionState(createBookAction, initial);
  const [mode, setMode] = useState<"choose" | "import">("choose");

  if (mode === "import") {
    return <ImportWizard onBack={() => setMode("choose")} />;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-title">
          <p className="page-eyebrow">{COPY.eyebrow}</p>
          <h1 className="page-title">{COPY.title}</h1>
          <p className="muted lead-tight">{COPY.lead}</p>
        </div>
      </div>

      <div className="grid-12">
        <section className="card choice-card col-6">
          <p className="page-eyebrow">{COPY.first}</p>
          <h2 className="card-title">{COPY.newBook}</h2>
          <p className="muted">{COPY.newHelp}</p>
          <form className="form-grid" action={formAction}>
            <div className="field">
              <label htmlFor="name">{COPY.name}</label>
              <input className="input" id="name" name="name" required placeholder="例如 聯倉" />
            </div>
            <p className="meta muted">{COPY.fx}</p>
            {state.error ? <p className="field-error">{state.error}</p> : null}
            <SubmitButton className="btn btn-primary btn-block" pendingLabel="儲存中">
              {COPY.open}
            </SubmitButton>
          </form>
        </section>

        <section className="card choice-card col-6">
          <p className="page-eyebrow">{COPY.later}</p>
          <h2 className="card-title">{COPY.importTitle}</h2>
          <p className="muted">{COPY.importHelp}</p>
          <button className="btn btn-secondary" type="button" onClick={() => setMode("import")}>
            {COPY.startImport}
          </button>
        </section>
      </div>

      <p className="footer-note">{COPY.footer}</p>
    </div>
  );
}
