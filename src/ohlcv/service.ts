import { nextUtcMinute, utcDateString } from "@/quotes/market-hours";
import { isDeniedSymbol, resolveInstrument } from "@/quotes/symbol-map";
import { getTwelveDataApiKey } from "@/quotes/twelve-data";
import type { CanonInstrument } from "@/quotes/types";
import { CREDIT_BUFFER, DEFAULT_DAILY_CREDIT_CAP } from "./constants";
import {
  addSharedCredits,
  loadCachedBars,
  loadFetchState,
  loadSharedCredits,
  saveCachedBars,
  saveFetchState,
} from "./store";
import { fetchPublicTimeSeries } from "./public-source";
import { fetchTwelveDataTimeSeries } from "./twelve-data";
import type {
  OhlcvBar,
  OhlcvFetchState,
  OhlcvStatus,
  OhlcvView,
  SharedCreditState,
  TimeSeriesOutcome,
} from "./types";

const inflight = new Map<string, Promise<OhlcvView>>();

const EMPTY_STATUSES: ReadonlySet<OhlcvStatus> = new Set([
  "no_key",
  "unauthorized",
  "plan",
  "not_found",
  "denied",
  "empty",
]);

export type OhlcvDeps = {
  now?: Date;
  getKey?: () => string | null;
  fetchSeries?: (instrument: CanonInstrument) => Promise<TimeSeriesOutcome>;
  fetchPublicSeries?: (instrument: CanonInstrument) => Promise<TimeSeriesOutcome>;
  loadBars?: (tdSymbol: string, exchange: string | null) => Promise<OhlcvBar[]>;
  saveBars?: (tdSymbol: string, exchange: string | null, bars: OhlcvBar[], fetchedAt: Date) => Promise<void>;
  loadState?: (tdSymbol: string, exchange: string | null) => Promise<OhlcvFetchState | null>;
  saveState?: (tdSymbol: string, exchange: string | null, state: OhlcvFetchState) => Promise<void>;
  loadCredits?: () => Promise<SharedCreditState>;
  addCredits?: (used: number, now: Date, rateLimited: boolean) => Promise<void>;
};

export function resetOhlcvFlights(): void {
  inflight.clear();
}

export function emptyOhlcvView(display: string, status: OhlcvStatus = "empty", planLimited = false): OhlcvView {
  return { display, bars: [], status, planLimited };
}

function dailyCreditCap(): number {
  const raw = process.env.TWELVE_DATA_DAILY_CREDIT_CAP?.trim();
  const n = raw ? Number(raw) : DEFAULT_DAILY_CREDIT_CAP;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_CREDIT_CAP;
}

function flightKey(tdSymbol: string, exchange: string | null): string {
  return `${tdSymbol}\0${exchange ?? ""}`;
}

function canUseLastGood(status: OhlcvStatus): boolean {
  return status === "rate_limited" || status === "upstream";
}

function planLimitedFor(instrument: CanonInstrument, status: OhlcvStatus, bars: OhlcvBar[]): boolean {
  return status === "plan" || (bars.length === 0 && instrument.planHint);
}

async function loadOhlcvPublic(
  instrument: CanonInstrument,
  deps: OhlcvDeps,
  cached: OhlcvBar[],
  state: OhlcvFetchState | null,
  now: Date,
  today: string,
): Promise<OhlcvView> {
  const fetchPublic = deps.fetchPublicSeries ?? fetchPublicTimeSeries;
  const saveBars = deps.saveBars ?? saveCachedBars;
  const saveState = deps.saveState ?? saveFetchState;

  if (state?.lastFetchUtcDate === today && state.lastStatus !== "no_key") {
    if (EMPTY_STATUSES.has(state.lastStatus)) {
      return emptyOhlcvView(
        instrument.display,
        state.lastStatus,
        planLimitedFor(instrument, state.lastStatus, []),
      );
    }
    return {
      display: instrument.display,
      bars: cached,
      status: cached.length > 0 ? "ok" : state.lastStatus,
      planLimited: planLimitedFor(instrument, state.lastStatus, cached),
    };
  }

  const outcome = await fetchPublic(instrument);
  const persistState = async (status: OhlcvStatus) => {
    await saveState(instrument.tdSymbol, instrument.tdExchange, {
      lastFetchUtcDate: today,
      lastStatus: status,
      lastAttemptAt: now,
    }).catch(() => undefined);
  };

  if (outcome.kind === "ok") {
    await saveBars(instrument.tdSymbol, instrument.tdExchange, outcome.bars, now).catch(() => undefined);
    await persistState("ok");
    return {
      display: instrument.display,
      bars: outcome.bars,
      status: "ok",
      planLimited: false,
    };
  }

  await persistState(outcome.kind);
  if (canUseLastGood(outcome.kind) && cached.length > 0) {
    return {
      display: instrument.display,
      bars: cached,
      status: outcome.kind,
      planLimited: planLimitedFor(instrument, outcome.kind, cached),
    };
  }
  return emptyOhlcvView(
    instrument.display,
    outcome.kind,
    planLimitedFor(instrument, outcome.kind, []),
  );
}

export async function loadOhlcv(display: string, deps: OhlcvDeps = {}): Promise<OhlcvView> {
  const code = display.trim().toUpperCase();
  if (!code) {
    return emptyOhlcvView("");
  }
  if (isDeniedSymbol(code)) {
    return emptyOhlcvView(code, "denied");
  }
  const instrument = resolveInstrument(code);
  if (!instrument) {
    return emptyOhlcvView(code, "empty");
  }

  const key = flightKey(instrument.tdSymbol, instrument.tdExchange);
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }
  const task = loadOhlcvUncached(instrument, deps).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, task);
  return task;
}

async function loadOhlcvUncached(instrument: CanonInstrument, deps: OhlcvDeps): Promise<OhlcvView> {
  const now = deps.now ?? new Date();
  const today = utcDateString(now);
  const getKey = deps.getKey ?? getTwelveDataApiKey;
  const fetchSeries = deps.fetchSeries ?? fetchTwelveDataTimeSeries;
  const loadBars = deps.loadBars ?? loadCachedBars;
  const saveBars = deps.saveBars ?? saveCachedBars;
  const loadState = deps.loadState ?? loadFetchState;
  const saveState = deps.saveState ?? saveFetchState;
  const loadCredits = deps.loadCredits ?? loadSharedCredits;
  const addCredits = deps.addCredits ?? addSharedCredits;

  const cached = await loadBars(instrument.tdSymbol, instrument.tdExchange).catch(() => [] as OhlcvBar[]);
  const state = await loadState(instrument.tdSymbol, instrument.tdExchange).catch(() => null);

  if (!getKey()) {
    return loadOhlcvPublic(instrument, deps, cached, state, now, today);
  }

  if (state?.lastFetchUtcDate === today) {
    if (EMPTY_STATUSES.has(state.lastStatus)) {
      return emptyOhlcvView(
        instrument.display,
        state.lastStatus,
        planLimitedFor(instrument, state.lastStatus, []),
      );
    }
    return {
      display: instrument.display,
      bars: cached,
      status: cached.length > 0 ? "ok" : state.lastStatus,
      planLimited: planLimitedFor(instrument, state.lastStatus, cached),
    };
  }

  const credits = await loadCredits().catch(
    (): SharedCreditState => ({
      lastPackAt: null,
      rateLimitedUntil: null,
      creditUtcDate: null,
      creditsUsed: 0,
    }),
  );
  const usedToday = credits.creditUtcDate === today ? credits.creditsUsed : 0;
  const rateLimited =
    credits.rateLimitedUntil != null && credits.rateLimitedUntil.getTime() > now.getTime();
  const overCap = usedToday + 1 > dailyCreditCap() - CREDIT_BUFFER;

  if (rateLimited || overCap) {
    return {
      display: instrument.display,
      bars: cached,
      status: "rate_limited",
      planLimited: planLimitedFor(instrument, "rate_limited", cached),
    };
  }

  const outcome = await fetchSeries(instrument);
  const persistState = async (status: OhlcvStatus) => {
    await saveState(instrument.tdSymbol, instrument.tdExchange, {
      lastFetchUtcDate: today,
      lastStatus: status,
      lastAttemptAt: now,
    }).catch(() => undefined);
  };

  if (outcome.kind === "ok") {
    await saveBars(instrument.tdSymbol, instrument.tdExchange, outcome.bars, now).catch(() => undefined);
    await persistState("ok");
    await addCredits(1, now, false).catch(() => undefined);
    return {
      display: instrument.display,
      bars: outcome.bars,
      status: "ok",
      planLimited: false,
    };
  }

  await persistState(outcome.kind);
  if (outcome.kind === "rate_limited" || outcome.kind === "upstream") {
    await addCredits(1, now, outcome.kind === "rate_limited").catch(() => undefined);
    if (canUseLastGood(outcome.kind) && cached.length > 0) {
      return {
        display: instrument.display,
        bars: cached,
        status: outcome.kind,
        planLimited: planLimitedFor(instrument, outcome.kind, cached),
      };
    }
    return emptyOhlcvView(instrument.display, outcome.kind, planLimitedFor(instrument, outcome.kind, []));
  }

  return emptyOhlcvView(
    instrument.display,
    outcome.kind,
    planLimitedFor(instrument, outcome.kind, []),
  );
}

export function nextMinute(now: Date): Date {
  return nextUtcMinute(now);
}
