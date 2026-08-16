import { addWeekdays, ema, highest, lowest, sma, stdev, trueRange, wilderSmooth, zipPoints } from "./math";
import type { Bar, ChartPane, LinePoint, OverlayLine } from "./types";

const COLORS = {
  sma20: "#edeee8",
  sma50: "#c4a574",
  sma200: "#7a9a8a",
  ema12: "#6b9fd4",
  ema26: "#b07cc6",
  vwma: "#d4a06a",
  bb: "#6b8e9a",
  donchian: "#8a7a5c",
  keltner: "#5c8a7a",
  ichimoku: "#9aa196",
  psar: "#c4a574",
  supertrend: "#3d9b6e",
  rsi: "#c4a574",
  macd: "#6b9fd4",
  signal: "#e06b63",
  histUp: "#3d9b6e",
  histDown: "#e06b63",
  stoch: "#6b9fd4",
  stochD: "#e06b63",
  cci: "#b07cc6",
  willr: "#c4a574",
  mfi: "#7a9a8a",
  obv: "#9aa196",
  atr: "#c4a574",
  adx: "#edeee8",
};

function closes(bars: Bar[]): number[] {
  return bars.map((bar) => bar.close);
}

function times(bars: Bar[]): string[] {
  return bars.map((bar) => bar.time);
}

function vwma(bars: Bar[], period: number): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: bars.length }, () => null);
  for (let i = period - 1; i < bars.length; i += 1) {
    let pv = 0;
    let vol = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      pv += bars[j].close * bars[j].volume;
      vol += bars[j].volume;
    }
    out[i] = vol === 0 ? null : pv / vol;
  }
  return out;
}

export function computeSma(values: Array<number | null>, period: number): Array<number | null> {
  return sma(values, period);
}

export function computeRsi(values: number[], period = 14): Array<number | null> {
  const gains: Array<number | null> = [null];
  const losses: Array<number | null> = [null];
  for (let i = 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    gains.push(delta > 0 ? delta : 0);
    losses.push(delta < 0 ? -delta : 0);
  }
  const avgGain = wilderSmooth(gains, period);
  const avgLoss = wilderSmooth(losses, period);
  return values.map((_, i) => {
    const gain = avgGain[i];
    const loss = avgLoss[i];
    if (gain == null || loss == null) {
      return null;
    }
    if (loss === 0) {
      return 100;
    }
    const rs = gain / loss;
    return 100 - 100 / (1 + rs);
  });
}

export function computeMacd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { macd: Array<number | null>; signal: Array<number | null>; hist: Array<number | null> } {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macd = values.map((_, i) => {
    if (fastEma[i] == null || slowEma[i] == null) {
      return null;
    }
    return fastEma[i]! - slowEma[i]!;
  });
  const signal = ema(macd, signalPeriod);
  const hist = macd.map((value, i) => (value == null || signal[i] == null ? null : value - signal[i]!));
  return { macd, signal, hist };
}

function atr(bars: Bar[], period: number): Array<number | null> {
  return wilderSmooth(trueRange(bars), period);
}

function bollinger(bars: Bar[], period = 20, mult = 2): { mid: Array<number | null>; upper: Array<number | null>; lower: Array<number | null> } {
  const mid = sma(closes(bars), period);
  const sd = stdev(closes(bars), period);
  const upper = mid.map((value, i) => (value == null || sd[i] == null ? null : value + mult * sd[i]!));
  const lower = mid.map((value, i) => (value == null || sd[i] == null ? null : value - mult * sd[i]!));
  return { mid, upper, lower };
}

function donchian(bars: Bar[], period = 20): { upper: Array<number | null>; lower: Array<number | null>; mid: Array<number | null> } {
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];
  const mid: Array<number | null> = [];
  for (let i = 0; i < bars.length; i += 1) {
    const hi = highest(highs, i, period);
    const lo = lowest(lows, i, period);
    upper.push(hi);
    lower.push(lo);
    mid.push(hi == null || lo == null ? null : (hi + lo) / 2);
  }
  return { upper, lower, mid };
}

function keltner(bars: Bar[], emaPeriod = 20, atrPeriod = 10, mult = 2): {
  mid: Array<number | null>;
  upper: Array<number | null>;
  lower: Array<number | null>;
} {
  const mid = ema(closes(bars), emaPeriod);
  const range = atr(bars, atrPeriod);
  const upper = mid.map((value, i) => (value == null || range[i] == null ? null : value + mult * range[i]!));
  const lower = mid.map((value, i) => (value == null || range[i] == null ? null : value - mult * range[i]!));
  return { mid, upper, lower };
}

function ichimoku(bars: Bar[], tenkanP = 9, kijunP = 26, senkouP = 52): OverlayLine[] {
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const t = times(bars);
  const tenkan: Array<number | null> = [];
  const kijun: Array<number | null> = [];
  const senkouB: Array<number | null> = [];
  for (let i = 0; i < bars.length; i += 1) {
    const th = highest(highs, i, tenkanP);
    const tl = lowest(lows, i, tenkanP);
    const kh = highest(highs, i, kijunP);
    const kl = lowest(lows, i, kijunP);
    const sh = highest(highs, i, senkouP);
    const sl = lowest(lows, i, senkouP);
    tenkan.push(th == null || tl == null ? null : (th + tl) / 2);
    kijun.push(kh == null || kl == null ? null : (kh + kl) / 2);
    senkouB.push(sh == null || sl == null ? null : (sh + sl) / 2);
  }
  const senkouA = tenkan.map((value, i) => (value == null || kijun[i] == null ? null : (value + kijun[i]!) / 2));
  const last = t[t.length - 1];
  const senkouAPoints: LinePoint[] = [];
  const senkouBPoints: LinePoint[] = [];
  for (let i = 0; i < bars.length; i += 1) {
    const time = i + kijunP < bars.length ? t[i + kijunP] : last ? addWeekdays(last, i + kijunP - bars.length + 1) : null;
    if (time && senkouA[i] != null) {
      senkouAPoints.push({ time, value: senkouA[i]! });
    }
    if (time && senkouB[i] != null) {
      senkouBPoints.push({ time, value: senkouB[i]! });
    }
  }
  const chikou: LinePoint[] = [];
  for (let i = kijunP; i < bars.length; i += 1) {
    chikou.push({ time: t[i - kijunP], value: bars[i].close });
  }
  return [
    { id: "ichimoku-tenkan", color: COLORS.ema12, points: zipPoints(t, tenkan), style: "solid" },
    { id: "ichimoku-kijun", color: COLORS.ema26, points: zipPoints(t, kijun), style: "solid" },
    { id: "ichimoku-span-a", color: COLORS.ichimoku, points: senkouAPoints, style: "dashed" },
    { id: "ichimoku-span-b", color: COLORS.bb, points: senkouBPoints, style: "dashed" },
    { id: "ichimoku-chikou", color: COLORS.sma50, points: chikou, style: "dashed" },
  ];
}

function psar(bars: Bar[], step = 0.02, max = 0.2): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: bars.length }, () => null);
  if (bars.length < 2) {
    return out;
  }
  let up = bars[1].close >= bars[0].close;
  let af = step;
  let ep = up ? bars[0].high : bars[0].low;
  let sar = up ? bars[0].low : bars[0].high;
  out[0] = sar;
  for (let i = 1; i < bars.length; i += 1) {
    out[i] = sar;
    if (up) {
      if (bars[i].low < sar) {
        up = false;
        sar = ep;
        ep = bars[i].low;
        af = step;
        out[i] = sar;
      } else {
        if (bars[i].high > ep) {
          ep = bars[i].high;
          af = Math.min(af + step, max);
        }
        let next = sar + af * (ep - sar);
        next = Math.min(next, bars[i].low, bars[i - 1].low);
        if (i >= 2) {
          next = Math.min(next, bars[i - 2].low);
        }
        sar = next;
      }
    } else if (bars[i].high > sar) {
      up = true;
      sar = ep;
      ep = bars[i].high;
      af = step;
      out[i] = sar;
    } else {
      if (bars[i].low < ep) {
        ep = bars[i].low;
        af = Math.min(af + step, max);
      }
      let next = sar + af * (ep - sar);
      next = Math.max(next, bars[i].high, bars[i - 1].high);
      if (i >= 2) {
        next = Math.max(next, bars[i - 2].high);
      }
      sar = next;
    }
  }
  return out;
}

function supertrend(bars: Bar[], atrPeriod = 10, mult = 3): Array<number | null> {
  const range = atr(bars, atrPeriod);
  const out: Array<number | null> = Array.from({ length: bars.length }, () => null);
  let finalUpper: number | null = null;
  let finalLower: number | null = null;
  let trendUp = true;
  for (let i = 0; i < bars.length; i += 1) {
    if (range[i] == null) {
      continue;
    }
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const basicUpper = hl2 + mult * range[i]!;
    const basicLower = hl2 - mult * range[i]!;
    if (finalUpper == null || finalLower == null) {
      finalUpper = basicUpper;
      finalLower = basicLower;
      out[i] = trendUp ? finalLower : finalUpper;
      continue;
    }
    finalUpper = basicUpper < finalUpper || bars[i - 1].close > finalUpper ? basicUpper : finalUpper;
    finalLower = basicLower > finalLower || bars[i - 1].close < finalLower ? basicLower : finalLower;
    if (trendUp) {
      trendUp = bars[i].close >= finalLower;
    } else {
      trendUp = bars[i].close > finalUpper;
    }
    out[i] = trendUp ? finalLower : finalUpper;
  }
  return out;
}

function stochastic(bars: Bar[], period = 14, kSmooth = 3, dSmooth = 3): {
  k: Array<number | null>;
  d: Array<number | null>;
} {
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const raw: Array<number | null> = bars.map((bar, i) => {
    const hi = highest(highs, i, period);
    const lo = lowest(lows, i, period);
    if (hi == null || lo == null || hi === lo) {
      return null;
    }
    return (100 * (bar.close - lo)) / (hi - lo);
  });
  const k = sma(raw, kSmooth);
  const d = sma(k, dSmooth);
  return { k, d };
}

function stochRsi(values: number[], rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3): {
  k: Array<number | null>;
  d: Array<number | null>;
} {
  const rsi = computeRsi(values, rsiPeriod);
  const raw: Array<number | null> = rsi.map((value, i) => {
    if (value == null) {
      return null;
    }
    const window: number[] = [];
    for (let j = i - stochPeriod + 1; j <= i; j += 1) {
      if (j < 0 || rsi[j] == null) {
        return null;
      }
      window.push(rsi[j]!);
    }
    const hi = Math.max(...window);
    const lo = Math.min(...window);
    if (hi === lo) {
      return 50;
    }
    return (100 * (value - lo)) / (hi - lo);
  });
  const k = sma(raw, kSmooth);
  const d = sma(k, dSmooth);
  return { k, d };
}

function cci(bars: Bar[], period = 20): Array<number | null> {
  const tp = bars.map((bar) => (bar.high + bar.low + bar.close) / 3);
  const mid = sma(tp, period);
  return tp.map((value, i) => {
    if (mid[i] == null || i < period - 1) {
      return null;
    }
    let md = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      md += Math.abs(tp[j] - mid[i]!);
    }
    md /= period;
    if (md === 0) {
      return 0;
    }
    return (value - mid[i]!) / (0.015 * md);
  });
}

function willr(bars: Bar[], period = 14): Array<number | null> {
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  return bars.map((bar, i) => {
    const hi = highest(highs, i, period);
    const lo = lowest(lows, i, period);
    if (hi == null || lo == null || hi === lo) {
      return null;
    }
    return (-100 * (hi - bar.close)) / (hi - lo);
  });
}

function mfi(bars: Bar[], period = 14): Array<number | null> {
  const tp = bars.map((bar) => (bar.high + bar.low + bar.close) / 3);
  const pos: number[] = [0];
  const neg: number[] = [0];
  for (let i = 1; i < bars.length; i += 1) {
    const flow = tp[i] * bars[i].volume;
    if (tp[i] > tp[i - 1]) {
      pos.push(flow);
      neg.push(0);
    } else if (tp[i] < tp[i - 1]) {
      pos.push(0);
      neg.push(flow);
    } else {
      pos.push(0);
      neg.push(0);
    }
  }
  return bars.map((_, i) => {
    if (i < period) {
      return null;
    }
    let p = 0;
    let n = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      p += pos[j];
      n += neg[j];
    }
    if (n === 0) {
      return 100;
    }
    return 100 - 100 / (1 + p / n);
  });
}

function obv(bars: Bar[]): Array<number | null> {
  const out: Array<number | null> = [];
  let value = 0;
  for (let i = 0; i < bars.length; i += 1) {
    if (i === 0) {
      out.push(0);
      continue;
    }
    if (bars[i].close > bars[i - 1].close) {
      value += bars[i].volume;
    } else if (bars[i].close < bars[i - 1].close) {
      value -= bars[i].volume;
    }
    out.push(value);
  }
  return out;
}

function adx(bars: Bar[], period = 14): Array<number | null> {
  const plusDm: Array<number | null> = [null];
  const minusDm: Array<number | null> = [null];
  for (let i = 1; i < bars.length; i += 1) {
    const up = bars[i].high - bars[i - 1].high;
    const down = bars[i - 1].low - bars[i].low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }
  const smoothPlus = wilderSmooth(plusDm, period);
  const smoothMinus = wilderSmooth(minusDm, period);
  const range = atr(bars, period);
  const dx: Array<number | null> = bars.map((_, i) => {
    if (smoothPlus[i] == null || smoothMinus[i] == null || range[i] == null || range[i] === 0) {
      return null;
    }
    const plusDi = (100 * smoothPlus[i]!) / range[i]!;
    const minusDi = (100 * smoothMinus[i]!) / range[i]!;
    const denom = plusDi + minusDi;
    if (denom === 0) {
      return 0;
    }
    return (100 * Math.abs(plusDi - minusDi)) / denom;
  });
  return wilderSmooth(dx, period);
}

function line(id: string, color: string, points: LinePoint[], style: OverlayLine["style"] = "solid"): OverlayLine {
  return { id, color, points, style };
}

export function computeOverlays(bars: Bar[], active: ReadonlySet<string>): OverlayLine[] {
  if (bars.length === 0) {
    return [];
  }
  const t = times(bars);
  const c = closes(bars);
  const overlays: OverlayLine[] = [];
  if (active.has("sma20")) {
    overlays.push(line("sma20", COLORS.sma20, zipPoints(t, sma(c, 20))));
  }
  if (active.has("sma50")) {
    overlays.push(line("sma50", COLORS.sma50, zipPoints(t, sma(c, 50))));
  }
  if (active.has("sma200")) {
    overlays.push(line("sma200", COLORS.sma200, zipPoints(t, sma(c, 200))));
  }
  if (active.has("ema12")) {
    overlays.push(line("ema12", COLORS.ema12, zipPoints(t, ema(c, 12))));
  }
  if (active.has("ema26")) {
    overlays.push(line("ema26", COLORS.ema26, zipPoints(t, ema(c, 26))));
  }
  if (active.has("vwma20")) {
    overlays.push(line("vwma20", COLORS.vwma, zipPoints(t, vwma(bars, 20))));
  }
  if (active.has("bbands")) {
    const bb = bollinger(bars);
    overlays.push(line("bb-mid", COLORS.bb, zipPoints(t, bb.mid), "dashed"));
    overlays.push(line("bb-up", COLORS.bb, zipPoints(t, bb.upper)));
    overlays.push(line("bb-lo", COLORS.bb, zipPoints(t, bb.lower)));
  }
  if (active.has("donchian")) {
    const dc = donchian(bars);
    overlays.push(line("dc-up", COLORS.donchian, zipPoints(t, dc.upper)));
    overlays.push(line("dc-mid", COLORS.donchian, zipPoints(t, dc.mid), "dashed"));
    overlays.push(line("dc-lo", COLORS.donchian, zipPoints(t, dc.lower)));
  }
  if (active.has("keltner")) {
    const kc = keltner(bars);
    overlays.push(line("kc-mid", COLORS.keltner, zipPoints(t, kc.mid), "dashed"));
    overlays.push(line("kc-up", COLORS.keltner, zipPoints(t, kc.upper)));
    overlays.push(line("kc-lo", COLORS.keltner, zipPoints(t, kc.lower)));
  }
  if (active.has("ichimoku")) {
    overlays.push(...ichimoku(bars));
  }
  if (active.has("psar")) {
    overlays.push({ id: "psar", color: COLORS.psar, points: zipPoints(t, psar(bars)), style: "dots" });
  }
  if (active.has("supertrend")) {
    overlays.push(line("supertrend", COLORS.supertrend, zipPoints(t, supertrend(bars))));
  }
  return overlays;
}

export function computePanes(bars: Bar[], active: ReadonlySet<string>): ChartPane[] {
  if (bars.length === 0) {
    return [];
  }
  const t = times(bars);
  const c = closes(bars);
  const panes: ChartPane[] = [];
  if (active.has("volume")) {
    panes.push({
      id: "volume",
      label: "成交量",
      plots: [
        {
          id: "volume",
          kind: "histogram",
          color: COLORS.histUp,
          points: bars.map((bar) => ({
            time: bar.time,
            value: bar.volume,
            color: bar.close >= bar.open ? COLORS.histUp : COLORS.histDown,
          })),
        },
      ],
    });
  }
  if (active.has("rsi")) {
    panes.push({
      id: "rsi",
      label: "RSI(14)",
      plots: [{ id: "rsi", kind: "line", color: COLORS.rsi, points: zipPoints(t, computeRsi(c, 14)) }],
    });
  }
  if (active.has("macd")) {
    const macd = computeMacd(c);
    panes.push({
      id: "macd",
      label: "MACD",
      plots: [
        {
          id: "macd-hist",
          kind: "histogram",
          color: COLORS.histUp,
          points: zipPoints(t, macd.hist).map((point) => ({
            ...point,
            color: point.value >= 0 ? COLORS.histUp : COLORS.histDown,
          })),
        },
        { id: "macd-line", kind: "line", color: COLORS.macd, points: zipPoints(t, macd.macd) },
        { id: "macd-signal", kind: "line", color: COLORS.signal, points: zipPoints(t, macd.signal) },
      ],
    });
  }
  if (active.has("stoch")) {
    const st = stochastic(bars);
    panes.push({
      id: "stoch",
      label: "Stoch",
      plots: [
        { id: "stoch-k", kind: "line", color: COLORS.stoch, points: zipPoints(t, st.k) },
        { id: "stoch-d", kind: "line", color: COLORS.stochD, points: zipPoints(t, st.d) },
      ],
    });
  }
  if (active.has("stochrsi")) {
    const st = stochRsi(c);
    panes.push({
      id: "stochrsi",
      label: "StochRSI",
      plots: [
        { id: "stochrsi-k", kind: "line", color: COLORS.stoch, points: zipPoints(t, st.k) },
        { id: "stochrsi-d", kind: "line", color: COLORS.stochD, points: zipPoints(t, st.d) },
      ],
    });
  }
  if (active.has("cci")) {
    panes.push({
      id: "cci",
      label: "CCI",
      plots: [{ id: "cci", kind: "line", color: COLORS.cci, points: zipPoints(t, cci(bars)) }],
    });
  }
  if (active.has("willr")) {
    panes.push({
      id: "willr",
      label: "%R",
      plots: [{ id: "willr", kind: "line", color: COLORS.willr, points: zipPoints(t, willr(bars)) }],
    });
  }
  if (active.has("mfi")) {
    panes.push({
      id: "mfi",
      label: "MFI",
      plots: [{ id: "mfi", kind: "line", color: COLORS.mfi, points: zipPoints(t, mfi(bars)) }],
    });
  }
  if (active.has("obv")) {
    panes.push({
      id: "obv",
      label: "OBV",
      plots: [{ id: "obv", kind: "line", color: COLORS.obv, points: zipPoints(t, obv(bars)) }],
    });
  }
  if (active.has("atr")) {
    panes.push({
      id: "atr",
      label: "ATR",
      plots: [{ id: "atr", kind: "line", color: COLORS.atr, points: zipPoints(t, atr(bars, 14)) }],
    });
  }
  if (active.has("adx")) {
    panes.push({
      id: "adx",
      label: "ADX",
      plots: [{ id: "adx", kind: "line", color: COLORS.adx, points: zipPoints(t, adx(bars)) }],
    });
  }
  return panes;
}

export type VolumePoint = LinePoint & { color?: string };
