/** Map domain throws to one human 繁中 sentence for forms. */
export function humanFormError(raw: string): string {
  if (raw.includes("未有報價")) {
    return "這檔未有報價";
  }
  if (raw === "數量必須大於 0") {
    return "數量不能是零";
  }
  if (raw === "要寫代碼") {
    return "未選標的";
  }
  if (raw === "金額必須大於 0") {
    return "金額不能是零";
  }
  if (raw === "價格必須大於 0") {
    return "價格不能是零";
  }
  if (raw === "匯率必須大於 0") {
    return "匯率不能是零";
  }
  return raw;
}
