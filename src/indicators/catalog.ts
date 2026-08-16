import type { IndicatorDef, IndicatorGroupId } from "./types";

export const INDICATOR_GROUPS: { id: IndicatorGroupId; label: string }[] = [
  { id: "ma", label: "均線" },
  { id: "channel", label: "通道" },
  { id: "momentum", label: "動量" },
  { id: "volume", label: "量能" },
  { id: "volatility", label: "波動" },
];

export const INDICATORS: readonly IndicatorDef[] = [
  { id: "sma20", group: "ma", groupLabel: "均線", label: "SMA20", title: "SMA 20", kind: "overlay", defaultOn: true },
  { id: "sma50", group: "ma", groupLabel: "均線", label: "SMA50", title: "SMA 50", kind: "overlay", defaultOn: false },
  { id: "sma200", group: "ma", groupLabel: "均線", label: "SMA200", title: "SMA 200", kind: "overlay", defaultOn: false },
  { id: "ema12", group: "ma", groupLabel: "均線", label: "EMA12", title: "EMA 12", kind: "overlay", defaultOn: false },
  { id: "ema26", group: "ma", groupLabel: "均線", label: "EMA26", title: "EMA 26", kind: "overlay", defaultOn: false },
  { id: "vwma20", group: "ma", groupLabel: "均線", label: "VWMA", title: "VWMA 20", kind: "overlay", defaultOn: false },
  { id: "bbands", group: "channel", groupLabel: "通道", label: "布林", title: "Bollinger 20,2σ", kind: "overlay", defaultOn: false },
  { id: "donchian", group: "channel", groupLabel: "通道", label: "Donchian", title: "Donchian 20", kind: "overlay", defaultOn: false },
  { id: "keltner", group: "channel", groupLabel: "通道", label: "Keltner", title: "Keltner 20,ATR10,2", kind: "overlay", defaultOn: false },
  { id: "ichimoku", group: "channel", groupLabel: "通道", label: "Ichimoku", title: "Ichimoku 9,26,52", kind: "overlay", defaultOn: false },
  { id: "psar", group: "channel", groupLabel: "通道", label: "PSAR", title: "Parabolic SAR 0.02,0.20", kind: "overlay", defaultOn: false },
  { id: "supertrend", group: "channel", groupLabel: "通道", label: "Supertrend", title: "Supertrend ATR10,3", kind: "overlay", defaultOn: false },
  { id: "rsi", group: "momentum", groupLabel: "動量", label: "RSI(14)", title: "RSI 14", kind: "pane", defaultOn: false },
  { id: "macd", group: "momentum", groupLabel: "動量", label: "MACD", title: "MACD 12,26,9", kind: "pane", defaultOn: false },
  { id: "stoch", group: "momentum", groupLabel: "動量", label: "Stoch", title: "Stochastic 14,3,3", kind: "pane", defaultOn: false },
  { id: "stochrsi", group: "momentum", groupLabel: "動量", label: "StochRSI", title: "StochRSI 14,14,3,3", kind: "pane", defaultOn: false },
  { id: "cci", group: "momentum", groupLabel: "動量", label: "CCI", title: "CCI 20", kind: "pane", defaultOn: false },
  { id: "willr", group: "momentum", groupLabel: "動量", label: "%R", title: "Williams %R 14", kind: "pane", defaultOn: false },
  { id: "volume", group: "volume", groupLabel: "量能", label: "成交量", title: "Volume", kind: "pane", defaultOn: true },
  { id: "mfi", group: "volume", groupLabel: "量能", label: "MFI", title: "MFI 14", kind: "pane", defaultOn: false },
  { id: "obv", group: "volume", groupLabel: "量能", label: "OBV", title: "OBV", kind: "pane", defaultOn: false },
  { id: "atr", group: "volatility", groupLabel: "波動", label: "ATR", title: "ATR 14", kind: "pane", defaultOn: false },
  { id: "adx", group: "volatility", groupLabel: "波動", label: "ADX", title: "ADX 14", kind: "pane", defaultOn: false },
];

export const FORBIDDEN_INDICATOR_IDS = ["vwap", "mom", "roc", "cmf"] as const;

export const DEFAULT_ON_IDS = INDICATORS.filter((row) => row.defaultOn).map((row) => row.id);

export function defaultActiveIds(): Set<string> {
  return new Set(DEFAULT_ON_IDS);
}
