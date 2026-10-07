export type IndicatorTheme = "light" | "dark";

export type IndicatorPalette = {
  sma20: string;
  sma50: string;
  sma200: string;
  ema12: string;
  ema26: string;
  vwma: string;
  bb: string;
  donchian: string;
  keltner: string;
  ichimoku: string;
  psar: string;
  supertrend: string;
  rsi: string;
  macd: string;
  signal: string;
  histUp: string;
  histDown: string;
  stoch: string;
  stochD: string;
  cci: string;
  willr: string;
  mfi: string;
  obv: string;
  atr: string;
  adx: string;
};

/** Dark navy chart. Existing hues; all ≥3:1 on `#0e1320` / `#161d2e`. */
const DARK: IndicatorPalette = {
  sma20: "#edeee8",
  sma50: "#c4a574",
  sma200: "#7a9a8a",
  ema12: "#6b9fd4",
  ema26: "#b07cc6",
  vwma: "#d4a06a",
  bb: "#6b8e9a",
  donchian: "#8a7a5c",
  keltner: "#5c8a7a",
  ichimoku: "#8f9db8",
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
  obv: "#8f9db8",
  atr: "#c4a574",
  adx: "#edeee8",
};

/**
 * Light paper chart. Same hue families as dark, darkened so every line is
 * ≥3:1 on `#faf8f5` and `#ffffff`, and none equals finance up/down.
 */
const LIGHT: IndicatorPalette = {
  sma20: "#454a52",
  sma50: "#8b5314",
  sma200: "#2a5644",
  ema12: "#1b588f",
  ema26: "#6d2f7a",
  vwma: "#7a6410",
  bb: "#2a5364",
  donchian: "#5e4520",
  keltner: "#1a5346",
  ichimoku: "#35476e",
  psar: "#8b5314",
  supertrend: "#0c5f58",
  rsi: "#8b5314",
  macd: "#1b588f",
  signal: "#9a2a58",
  histUp: "#0c5f58",
  histDown: "#9a2a58",
  stoch: "#1b588f",
  stochD: "#9a2a58",
  cci: "#6d2f7a",
  willr: "#8b5314",
  mfi: "#2a5644",
  obv: "#35476e",
  atr: "#8b5314",
  adx: "#454a52",
};

export const INDICATOR_PALETTES: Record<IndicatorTheme, IndicatorPalette> = {
  dark: DARK,
  light: LIGHT,
};

export function indicatorPalette(theme: IndicatorTheme): IndicatorPalette {
  return INDICATOR_PALETTES[theme];
}

export function isIndicatorTheme(value: string | null): value is IndicatorTheme {
  return value === "light" || value === "dark";
}
