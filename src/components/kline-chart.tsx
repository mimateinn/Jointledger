"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { computeOverlays, computePanes, priceFormatFromBars, type Bar } from "@/indicators";
import { isIndicatorTheme, type IndicatorTheme } from "@/indicators/palette";

function readToken(name: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function asTime(time: string): UTCTimestamp {
  return Math.floor(new Date(`${time}T00:00:00Z`).getTime() / 1000) as UTCTimestamp;
}

/** Resolved appearance: `data-theme` (暖紙 / 夜頁 / system-light|dark), else OS. */
function resolvedAppearance(): IndicatorTheme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (isIndicatorTheme(attr)) {
    return attr;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function KlineChart({
  bars,
  active,
  expanded = false,
}: {
  bars: Bar[];
  active: ReadonlySet<string>;
  expanded?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [themeKey, setThemeKey] = useState<IndicatorTheme>("dark");

  useEffect(() => {
    const read = () => setThemeKey(resolvedAppearance());
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-theme-pref"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", read);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", read);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || bars.length === 0) {
      return;
    }

    const bg = readToken("--bg", "#0e1320");
    const text = readToken("--muted", "#8f9db8");
    const border = readToken("--border", "#2a3550");
    const up = readToken("--up", "#42a375");
    const down = readToken("--down", "#e6746c");
    const format = priceFormatFromBars(bars);
    const paneCount = computePanes(bars, active, themeKey).length;
    const frame = host.parentElement;
    if (expanded) {
      host.style.height = "100%";
      if (frame) {
        frame.style.aspectRatio = "auto";
      }
    } else {
      host.style.height = "100%";
      if (frame) {
        frame.style.aspectRatio = `16 / ${10 + paneCount * 2}`;
      }
    }

    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border },
      },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, timeVisible: false },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const candles = chart.addSeries(
      CandlestickSeries,
      {
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
        priceFormat: { type: "price", precision: format.precision, minMove: format.minMove },
      },
      0,
    );
    candles.setData(
      bars.map((bar) => ({
        time: asTime(bar.time),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    );

    for (const overlay of computeOverlays(bars, active, themeKey)) {
      const series = chart.addSeries(
        LineSeries,
        {
          color: overlay.color,
          lineWidth: 1,
          lineStyle: overlay.style === "dashed" ? LineStyle.Dashed : LineStyle.Solid,
          pointMarkersVisible: overlay.style === "dots",
          lineVisible: overlay.style !== "dots",
          priceLineVisible: false,
          lastValueVisible: false,
        },
        0,
      );
      series.setData(
        overlay.points
          .map((point) => ({ time: asTime(point.time), value: point.value }))
          .sort((a, b) => a.time - b.time),
      );
    }

    computePanes(bars, active, themeKey).forEach((pane, index) => {
      const paneIndex = index + 1;
      for (const plot of pane.plots) {
        if (plot.kind === "histogram") {
          const series = chart.addSeries(
            HistogramSeries,
            {
              priceFormat: pane.id === "volume" ? { type: "volume" } : { type: "price", precision: 2, minMove: 0.01 },
              priceLineVisible: false,
              lastValueVisible: false,
            },
            paneIndex,
          );
          series.setData(
            plot.points.map((point) => ({
              time: asTime(point.time),
              value: point.value,
              color: point.color ?? plot.color,
            })),
          );
        } else {
          const series = chart.addSeries(
            LineSeries,
            {
              color: plot.color,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
            },
            paneIndex,
          );
          series.setData(plot.points.map((point) => ({ time: asTime(point.time), value: point.value })));
        }
      }
    });

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, active, expanded, themeKey]);

  if (bars.length === 0) {
    return (
      <div className="kline-empty" role="img" aria-label="未有日線">
        <p className="body">未有日線</p>
        <p className="meta muted">這檔還沒有可畫的區間</p>
      </div>
    );
  }

  return <div ref={hostRef} className="kline chart-enter" role="img" aria-label="日線圖" />;
}
