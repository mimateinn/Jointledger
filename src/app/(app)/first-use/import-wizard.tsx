"use client";

import { useActionState, useState } from "react";
import {
  commitImportAction,
  confirmMapAction,
  parseImportAction,
  type ImportActionState,
} from "@/app/actions/import";
import type { ColumnTarget } from "@/import/types";

const initial: ImportActionState = {};

const TI_OPTIONS: { value: ColumnTarget; label: string }[] = [
  { value: "ignore", label: "略過" },
  { value: "symbol", label: "代碼" },
  { value: "quantity", label: "數量" },
  { value: "own", label: "Own" },
  { value: "buy_date", label: "買入日期" },
  { value: "buy_price", label: "買入價" },
  { value: "buy_total", label: "買入總額" },
  { value: "sell_date", label: "賣出日期" },
  { value: "sell_price", label: "賣出價" },
  { value: "sell_fee", label: "賣出手續費" },
  { value: "sell_total", label: "賣出總額" },
  { value: "pnl", label: "盈虧" },
  { value: "split_hey", label: "Hey 分帳" },
  { value: "split_sze", label: "Sze 分帳" },
  { value: "split_wah", label: "Wah 分帳" },
];

const AD_OPTIONS: { value: ColumnTarget; label: string }[] = [
  { value: "ignore", label: "略過" },
  { value: "date", label: "日期" },
  { value: "detail", label: "明細" },
  { value: "own", label: "Own" },
  { value: "hkd", label: "港元" },
  { value: "fx", label: "匯率" },
  { value: "usd", label: "美元" },
  { value: "in_out", label: "出入" },
];

export function ImportWizard({
  onBack,
  reimport = false,
}: {
  onBack?: () => void;
  reimport?: boolean;
}) {
  const [parsed, parseAction, parsePending] = useActionState(parseImportAction, initial);
  const [mapped, mapAction, mapPending] = useActionState(confirmMapAction, initial);
  const [committed, commitAction, commitPending] = useActionState(commitImportAction, initial);
  const [bulk, setBulk] = useState<"import" | "skip" | "">("");

  const state = committed.draftId || committed.error ? committed : mapped.draftId ? mapped : parsed;
  const preview = state.preview;
  const showMap = Boolean(state.needsMap && state.draftId);
  const showPreview = Boolean(state.draftId && preview && !state.needsMap);

  return (
    <div className="stack">
      <div>
        <h1 className="display">{reimport ? "再匯入" : "匯入而家用緊嘅試算表"}</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          {reimport
            ? "寫入而家呢本記帳表。要明示追加或取代。認領唔會開新表，亦唔會當匯入解鎖。"
            : "把而家用緊嘅試算表搬過嚟。預覽成員、買賣、出入金；對唔上嘅列會單獨標出，確認持股先寫入。"}
        </p>
      </div>

      {!state.draftId ? (
        <section className="card stack">
          <p className="muted">上傳 xlsx（TransInfo + Account Detail 兩頁），或兩個 csv。唔會連接 Google 試算表。</p>
          <form className="form-grid" action={parseAction}>
            {reimport ? <input type="hidden" name="reimport" value="1" /> : null}
            <div className="field">
              <label htmlFor="files">檔案</label>
              <input
                className="input"
                id="files"
                name="files"
                type="file"
                accept=".csv,.xlsx"
                multiple
                required
              />
            </div>
            {state.error ? <p className="alert">{state.error}</p> : null}
            <div className="submit-row">
              <button className="btn btn-primary" type="submit" disabled={parsePending}>
                預覽
              </button>
              {onBack ? (
                <button className="btn btn-ghost" type="button" onClick={onBack}>
                  返回
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      {showMap ? (
        <section className="card stack">
          <h2 className="title">欄位未確認 · 零寫入</h2>
          <p className="muted">認唔到嘅欄或一欄對多個目標要你確認。唔會估「呢個一定係數量」。</p>
          <form className="form-grid" action={mapAction}>
            {reimport ? <input type="hidden" name="reimport" value="1" /> : null}
            <input type="hidden" name="draftId" value={state.draftId} />
            <h3 className="meta">TransInfo</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>檔案欄</th>
                  <th>對應</th>
                </tr>
              </thead>
              <tbody>
                {state.transinfoHeaders?.map((header, index) => (
                  <tr key={`ti-${header}-${index}`}>
                    <td>{header || "（空）"}</td>
                    <td>
                      <select
                        className="select"
                        name={`ti-${index}`}
                        defaultValue={state.transinfoTargets?.[index] ?? ""}
                      >
                        <option value="">未對</option>
                        {TI_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="meta">Account Detail</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>檔案欄</th>
                  <th>對應</th>
                </tr>
              </thead>
              <tbody>
                {state.accountHeaders?.map((header, index) => (
                  <tr key={`ad-${header}-${index}`}>
                    <td>{header || "（空）"}</td>
                    <td>
                      <select
                        className="select"
                        name={`ad-${index}`}
                        defaultValue={state.accountTargets?.[index] ?? ""}
                      >
                        <option value="">未對</option>
                        {AD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.error ? <p className="alert">{state.error}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={mapPending}>
              確認欄位
            </button>
          </form>
        </section>
      ) : null}

      {showPreview && preview ? (
        <section className="card stack">
          <h2 className="title">預覽</h2>
          <p className="muted">
            成員 {preview.counts.members} · 出入金 {preview.counts.cashFlows} · 買賣 {preview.counts.trades} ·
            警告 {preview.counts.warnings} · 略過 {preview.counts.skipped} · 待確認 {preview.counts.pending}
          </p>
          <div>
            <div className="meta muted">Own → 帳</div>
            <ul className="own-map">
              {preview.ownMapping.map((row) => (
                <li key={row.own}>
                  <span className="chip">{row.own}</span> {row.account}
                </li>
              ))}
            </ul>
          </div>
          {preview.issues.filter((item) => item.pending).length > 0 ? (
            <div>
              <h3 className="title">待確認</h3>
              <p className="muted">2020–21 未平倉同 分帳 追溯分帳唔當鎖定真相。對唔上嘅列單獨標出。</p>
            </div>
          ) : null}
          <form className="form-grid" action={commitAction}>
            {reimport ? <input type="hidden" name="reimport" value="1" /> : null}
            <input type="hidden" name="draftId" value={state.draftId} />
            {reimport ? null : (
              <div className="field">
                <label htmlFor="bookName">記帳表名稱</label>
                <input className="input" id="bookName" name="bookName" defaultValue="聯倉" />
              </div>
            )}
            {reimport ? (
              <div className="field">
                <label htmlFor="reimportMode">寫入方式</label>
                <select className="select" id="reimportMode" name="reimportMode" required defaultValue="">
                  <option value="">揀追加或取代</option>
                  <option value="append">追加</option>
                  <option value="replace">取代</option>
                </select>
              </div>
            ) : null}
            {preview.issues.filter((item) => item.pending).length > 0 ? (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>列</th>
                      <th>說明</th>
                      <th>決定</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.issues
                      .filter((item) => item.pending)
                      .map((issue) => (
                        <tr key={issue.id}>
                          <td className="tabular">
                            {issue.symbol ?? "—"} · {issue.row}
                          </td>
                          <td>
                            <span className="chip chip-delay">待確認</span> {issue.message}
                          </td>
                          <td>
                            <select className="select" name={`pending-${issue.id}`} defaultValue={bulk}>
                              <option value="">未揀</option>
                              <option value="import">一併匯入</option>
                              <option value="skip">略過</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div className="submit-row">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setBulk("import")}
                  >
                    全部一併匯入
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setBulk("skip")}>
                    全部略過
                  </button>
                </div>
                <input type="hidden" name="pendingBulk" value={bulk} />
              </>
            ) : null}
            {preview.issues.filter((item) => !item.pending).length > 0 ? (
              <ul className="muted">
                {preview.issues
                  .filter((item) => !item.pending)
                  .slice(0, 12)
                  .map((issue) => (
                    <li key={issue.id}>{issue.message}</li>
                  ))}
              </ul>
            ) : null}
            {!reimport && state.needsReimport ? (
              <div className="field">
                <label htmlFor="reimportMode">呢份檔已匯入過</label>
                <select className="select" id="reimportMode" name="reimportMode" required>
                  <option value="">揀追加或取代</option>
                  <option value="append">追加</option>
                  <option value="replace">取代</option>
                </select>
              </div>
            ) : null}
            {state.error ? <p className="alert">{state.error}</p> : null}
            <div className="submit-row">
              <button className="btn btn-primary" type="submit" disabled={commitPending}>
                確認寫入
              </button>
              {onBack ? (
                <button className="btn btn-ghost" type="button" onClick={onBack}>
                  取消
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      <p className="footer-note">
        記帳唔係下單。密碼只保護呢本記帳，唔會連接任何券商或股票戶口。
      </p>
    </div>
  );
}
