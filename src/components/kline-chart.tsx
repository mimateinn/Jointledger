"use client";

import { useEffect, useRef } from "react";
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

export function KlineChart({
  bars,
  active,
}: {
  bars: Bar[];
  active: ReadonlySet<string>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || bars.length === 0) {
      return;
    }

    const bg = readToken("--bg", "#121411");
    const text = readToken("--muted", "#9aa196");
    const border = readToken("--border", "#2c2f2a");
    const up = readToken("--up", "#3d9b6e");
    const down = readToken("--down", "#e06b63");
    const format = priceFormatFromBars(bars);
    const paneCount = computePanes(bars, active).length;
    host.style.height = `${Math.max(360, 300 + paneCount * 88)}px`;

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

    for (const overlay of computeOverlays(bars, active)) {
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

    computePanes(bars, active).forEach((pane, index) => {
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
  }, [bars, active]);

  if (bars.length === 0) {
    return (
      <div className="kline-empty" role="img" aria-label="未有日線">
        <div className="display">—</div>
        <p className="muted">未有日線</p>
      </div>
    );
  }

  return <div ref={hostRef} className="kline" role="img" aria-label="日線圖" />;
}
