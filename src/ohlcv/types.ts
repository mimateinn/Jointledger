export type OhlcvBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OhlcvStatus =
  | "ok"
  | "no_key"
  | "unauthorized"
  | "plan"
  | "not_found"
  | "denied"
  | "rate_limited"
  | "upstream"
  | "empty";

export type OhlcvView = {
  display: string;
  bars: OhlcvBar[];
  status: OhlcvStatus;
  planLimited: boolean;
};

export type TimeSeriesOutcome =
  | { kind: "ok"; bars: OhlcvBar[] }
  | { kind: "no_key" }
  | { kind: "unauthorized" }
  | { kind: "plan" }
  | { kind: "not_found" }
  | { kind: "denied" }
  | { kind: "rate_limited" }
  | { kind: "upstream" }
  | { kind: "empty" };

export type OhlcvFetchState = {
  lastFetchUtcDate: string | null;
  lastStatus: OhlcvStatus;
  lastAttemptAt: Date | null;
};

export type SharedCreditState = {
  lastPackAt: Date | null;
  rateLimitedUntil: Date | null;
  creditUtcDate: string | null;
  creditsUsed: number;
};
