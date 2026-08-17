export type Bar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type LinePoint = { time: string; value: number; color?: string };

export type IndicatorKind = "overlay" | "pane";

export type IndicatorGroupId = "ma" | "channel" | "momentum" | "volume" | "volatility";

export type IndicatorDef = {
  id: string;
  group: IndicatorGroupId;
  groupLabel: string;
  label: string;
  title: string;
  kind: IndicatorKind;
  defaultOn: boolean;
};

export type OverlayLine = {
  id: string;
  color: string;
  points: LinePoint[];
  style: "solid" | "dashed" | "dots";
  lineWidth?: number;
};

export type PanePlot = {
  id: string;
  kind: "line" | "histogram";
  color: string;
  points: LinePoint[];
};

export type ChartPane = {
  id: string;
  label: string;
  plots: PanePlot[];
};

export type PriceDomain = { min: number; max: number };
