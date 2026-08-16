"use client";

import { useActionState } from "react";
import { createBookAction, type BookState } from "@/app/actions/book";

const initial: BookState = {};

export function FirstUseForm() {
  const [state, formAction, pending] = useActionState(createBookAction, initial);

  return (
    <div className="stack">
      <div>
        <h1 className="display">你要點開始？</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          呢度只係記帳。唔會開券商戶口，亦唔會下單。
        </p>
      </div>

      <div className="grid grid-nav">
        <section className="card choice-card is-disabled">
          <div className="choice-mark">A</div>
          <h2 className="title">匯入現有 兩頁 xlsx</h2>
          <p className="muted">
            把而家 Google Sheet 搬過嚟。預覽成員、買賣、出入金；對唔上嘅列會單獨標出，確認未平倉先寫入。
          </p>
          <button className="btn btn-ghost" type="button" disabled>
            開始匯入
          </button>
        </section>

        <section className="card choice-card">
          <div className="choice-mark">B</div>
          <h2 className="title">開張新記帳表</h2>
          <p className="muted">
            由零開始。成員之後在帳戶頁加，對方用顯示名或電郵自己設密碼。唔使邀請碼。
          </p>
          <form className="form-grid" action={formAction}>
            <div className="field">
              <label htmlFor="name">記帳表名稱</label>
              <input className="input" id="name" name="name" required placeholder="例如 聯倉" />
            </div>
            <p className="meta muted">買賣貨幣 USD · 入金貨幣 HKD</p>
            {state.error ? <p className="alert">{state.error}</p> : null}
            <button className="btn btn-secondary" type="submit" disabled={pending}>
              開新表
            </button>
          </form>
        </section>
      </div>

      <p className="footer-note">
        記帳唔係下單。密碼只保護呢本記帳，唔會連接任何券商或股票戶口。
      </p>
    </div>
  );
}
