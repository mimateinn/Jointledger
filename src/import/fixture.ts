import { mapUpload } from "./columns";
import { buildPlan } from "./plan";
import type { ParsedSheet } from "./types";

/** Sample rows: cash 1000 + buy cost 500, plus known sheet mismatches. */
export function sampleSheets(): { transinfo: ParsedSheet; account: ParsedSheet } {
  const transinfo: ParsedSheet = {
    kind: "transinfo",
    name: "TransInfo",
    headers: ["Code", "Qty", "Own", "Buy Date", "Buy Price", "Buy Total", "Sell Date", "Sell Price", "Sell Fee", "Sell Total"],
    rows: [
      ["NVDA", "10", "H", "2024-01-02", "50", "500", "", "", "", ""],
      ["AAPL", "5", "H", "2024-03-01", "20", "100", "", "", "", ""],
    ],
  };
  const account: ParsedSheet = {
    kind: "account",
    name: "Account Detail",
    headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
    rows: [
      ["2024-01-01", "入金", "H", "1000", "1", "1000", "in"],
      ["2024-01-02", "NVDA", "F", "", "", "", ""],
      ["2024-01-01", "allocation 50 / 50", "F", "", "", "", ""],
      ["2024-01-15", "allocation 50 / 50", "F", "", "", "", ""],
      ["2024-02-01", "TSLA", "B", "200", "1", "200", ""],
    ],
  };
  return { transinfo, account };
}

export function samplePlan() {
  const { transinfo, account } = sampleSheets();
  const mapping = mapUpload(transinfo, account);
  return buildPlan("sample.xlsx", "hash-sample", transinfo, account, mapping);
}
