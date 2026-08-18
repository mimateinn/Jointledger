"use client";

import { useActionState, useState } from "react";
import { createBookAction, type BookState } from "@/app/actions/book";
import { SubmitButton } from "@/components/submit-button";
import { ImportWizard } from "./import-wizard";

const initial: BookState = {};

export function FirstUseForm() {
  const [state, formAction] = useActionState(createBookAction, initial);
  const [mode, setMode] = useState<"choose" | "import">("choose");

  if (mode === "import") {
    return <ImportWizard onBack={() => setMode("choose")} />;
  }

  return (
    <div className="stack">
      <div>
        <h1 className="display">你要點開始？</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          呢度只係記帳。唔會開券商戶口，亦唔會下單。
        </p>
      </div>

      <div className="grid grid-nav">
        <section className="card choice-card">
          <div className="choice-mark">先做呢步</div>
          <h2 className="title">開張新記帳表</h2>
          <p className="muted">由零開始。之後由而家嘅人加成員。而家未開放自己註冊。</p>
          <form className="form-grid" action={formAction}>
            <div className="field">
              <label htmlFor="name">記帳表名稱</label>
              <input className="input" id="name" name="name" required placeholder="例如 聯倉" />
            </div>
            <p className="meta muted">買賣貨幣 USD · 入金貨幣 HKD</p>
            {state.error ? <p className="alert">{state.error}</p> : null}
            <SubmitButton className="btn btn-primary" pendingLabel="儲存中">
              開新表
            </SubmitButton>
          </form>
        </section>

        <section className="card choice-card">
          <div className="choice-mark">稍後先做</div>
          <h2 className="title">匯入而家用緊嘅試算表</h2>
          <p className="muted">
            把而家用緊嘅試算表搬過嚟。預覽成員、買賣、出入金；對唔上嘅列會單獨標出，確認持股先寫入。
          </p>
          <button className="btn btn-ghost" type="button" onClick={() => setMode("import")}>
            開始匯入
          </button>
        </section>
      </div>

      <p className="footer-note">
        記帳唔係下單。密碼只保護呢本記帳，唔會連接任何券商或股票戶口。
      </p>
    </div>
  );
}
