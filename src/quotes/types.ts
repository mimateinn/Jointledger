export type AssetClass = "etf" | "equity" | "fx" | "crypto" | "commodity" | "index";

export type QuoteStatus =
  | "ok"
  | "no_key"
  | "unauthorized"
  | "plan"
  | "not_found"
  | "denied"
  | "rate_limited"
  | "upstream"
  | "empty";

export type CanonInstrument = {
  display: string;
  displayName: string | null;
  assetClass: AssetClass;
  market: string;
  tdSymbol: string;
  tdExchange: string | null;
  isEtfProxy: boolean;
  tapeSlot: number | null;
  planHint: boolean;
};

export type QuoteRow = {
  display: string;
  last: string | null;
  percentChange: string | null;
  previousClose: string | null;
  quotedAt: Date | null;
  fetchedAt: Date;
  delaySeconds: number;
  status: QuoteStatus;
  source: "twelve_data";
};

/** Safe for the browser: no Twelve Data symbol, exchange, or key. */
export type QuoteView = {
  display: string;
  name: string | null;
  last: string | null;
  percentChange: string | null;
  delayLabel: string;
  lastUpdateLabel: string | null;
  isEtfProxy: boolean;
  planLimited: boolean;
};

export type UpstreamOutcome =
  | {
      kind: "ok";
      last: string;
      percentChange: string | null;
      previousClose: string | null;
      quotedAt: Date | null;
    }
  | { kind: "no_key" }
  | { kind: "unauthorized" }
  | { kind: "plan" }
  | { kind: "not_found" }
  | { kind: "denied" }
  | { kind: "rate_limited" }
  | { kind: "upstream" }
  | { kind: "empty" };

export type DisplayedMark = {
  last: string | null;
  percentChange: string | null;
  usedLastGood: boolean;
  status: QuoteStatus;
};
