"use client";

import { allocColor, type AllocResult } from "@/lib/holdings-allocation";
import { formatUsd } from "@/lib/format";

const COPY = {
  total: "總市值",
  emptyTitle: "未有持倉",
  empty: "未有持倉，暫時冇分佈可睇",
  single: "目前只有一個市場",
  hint: "根據而家持倉市值計算，只係描述，唔係配置建議。",
};

export function AllocationChart({ result, title }: { result: AllocResult; title: string }) {
  const r = 88;
  const stroke = 24;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const label = `${title}：${result.slices.map((s) => `${s.label} ${s.pct.toFixed(1)}%`).join("、")}`;

  if (result.total <= 0) {
    return (
      <div className="state-panel">
        <p className="card-title">{COPY.emptyTitle}</p>
        <p>{COPY.empty}</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="meta muted">{COPY.hint}</p>
      <svg className="alloc-chart" viewBox="0 0 220 220" role="img" aria-label={label}>
        <g transform="translate(110 110)">
          {result.slices.map((slice, index) => {
            const len = (slice.pct / 100) * c;
            const dash = `${len} ${c - len}`;
            const rot = (offset / c) * 360 - 90;
            offset += len;
            return (
              <circle
                key={slice.key}
                r={r}
                fill="none"
                stroke={allocColor(index)}
                strokeWidth={stroke}
                strokeDasharray={dash}
                transform={`rotate(${rot})`}
                strokeLinecap="butt"
              />
            );
          })}
          <text textAnchor="middle" y="-6" fill="var(--muted)" fontSize="12">
            {COPY.total}
          </text>
          <text textAnchor="middle" y="16" fill="var(--text)" fontSize="16" fontWeight="600">
            {formatUsd(result.total.toFixed(2))}
          </text>
        </g>
      </svg>
      {result.singleGroup ? <p className="meta muted">{COPY.single}</p> : null}
      <ul className="alloc-legend">
        {result.slices.map((slice, index) => (
          <li key={slice.key} className="preview-row">
            <span>
              <span className="alloc-swatch" style={{ background: allocColor(index) }} />
              {slice.label}
            </span>
            <span className="num">
              {formatUsd(slice.value.toFixed(2))} · {slice.pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
