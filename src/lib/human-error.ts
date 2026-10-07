import { DELETE_BLOCKED_BY_LATER } from "@/ledger/delete-entry";
import { ISO_DATE_INVALID } from "@/lib/format";

const GENERIC = "儲存失敗";

/** Exact known app messages only. Raw SQL with Chinese params must not leak. */
const REMAP = new Map<string, string>([
  ["這代碼未有報價", "這檔未有報價"],
  ["這檔未有報價", "這檔未有報價"],
  ["數量必須大於 0", "數量不能是零"],
  ["要寫代碼", "未選標的"],
  ["金額必須大於 0", "金額不能是零"],
  ["價格必須大於 0", "價格不能是零"],
  ["匯率必須大於 0", "匯率不能是零"],
  ["成本必須大於 0", "金額不能是零"],
  ["賣出金額必須大於 0", "金額不能是零"],
  ["拆股新股必須大於 0", "拆股比例不能是零"],
  ["拆股舊股必須大於 0", "拆股比例不能是零"],
]);

const PASSTHROUGH = new Set<string>([
  ...REMAP.keys(),
  ...REMAP.values(),
  "調整要寫備註",
  "請填股息美金",
  "要有分配",
  "買賣只能是買入或賣出",
  "金額格式不正確",
  "要寫記帳表名稱",
  "要寫顯示名",
  "要寫生效日",
  "分配必須大於 0",
  "搵唔到呢筆記錄",
  "搵唔到呢筆持倉",
  "搵唔到呢個成員",
  "呢個用戶仲開住記帳表，刪唔到",
  DELETE_BLOCKED_BY_LATER,
  ISO_DATE_INVALID,
  "入金失敗",
  "記帳失敗",
  "刪持倉失敗",
  "刪除失敗",
  "刪成員失敗",
  "未有記帳表",
]);

/** Map domain throws to one human 繁中 sentence for forms. */
export function humanFormError(raw: string): string {
  const mapped = REMAP.get(raw);
  if (mapped) {
    return mapped;
  }
  if (PASSTHROUGH.has(raw)) {
    return raw;
  }
  return GENERIC;
}
