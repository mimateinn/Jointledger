"use client";

import { useMemo, useState } from "react";
import { EmptyPanel } from "@/components/empty-panel";
import { formatMoney, formatSignedUsd } from "@/lib/format";
import { formatDietzPercent, type MemberReturn, type PeriodKey, type ReturnsReport } from "@/returns/report";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "1m", label: "近1月" },
  { key: "3m", label: "3月" },
  { key: "ytd", label: "今年" },
  { key: "custom", label: "自訂" },
];

const COLORS = ["var(--up)", "var(--text)", "var(--muted)", "var(--ink)"];

function signedMoney(value: string): string {
  return formatSignedUsd(value);
}

function memberColor(index: number): string {
  return COLORS[index % COLORS.length];
}

export function ReturnsClient({
  report,
  emptyBook,
}: {
  report: ReturnsReport;
  emptyBook: boolean;
}) {
  const [showOld, setShowOld] = useState(false);
  const [showPrincipal, setShowPrincipal] = useState(false);

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="title">收益率</h1>
        <div className="submit-row">
          {!emptyBook ? (
            <button
              type="button"
              className={showPrincipal ? "chip chip-active" : "chip"}
              onClick={() => setShowPrincipal((value) => !value)}
            >
              對本金{showPrincipal ? " ×" : ""}
            </button>
          ) : null}
          {!emptyBook ? (
            <button
              type="button"
              className={showOld ? "chip chip-active" : "chip"}
              onClick={() => setShowOld((value) => !value)}
            >
              舊表對照 · 可關
            </button>
          ) : null}
        </div>
      </div>

      {emptyBook ? (
        <EmptyPanel sentence="未有流水，收益率暫時無得計。" actionLabel="記一筆" />
      ) : (
      <>
      <form className="chip-row" method="get">
        {PERIODS.map((item) => (
          <button
            key={item.key}
            className={report.periodKey === item.key ? "chip chip-active" : "chip"}
            name="range"
            value={item.key}
            type="submit"
          >
            {item.label}
          </button>
        ))}
        {report.periodKey === "custom" ? (
          <>
            <input className="input" type="date" name="from" defaultValue={report.periodStart} />
            <input className="input" type="date" name="to" defaultValue={report.periodEnd} />
            <button className="btn btn-secondary" type="submit">
              套用
            </button>
          </>
        ) : null}
      </form>

      <div className="grid grid-metrics">
        <section className="card">
          <div className="meta muted">期間淨值</div>
          <div className={`display ${Number(report.book.periodPnlUsd) < 0 ? "down" : "up"}`}>
            {signedMoney(report.book.periodPnlUsd)}
          </div>
          <p className="metric-sub">現金+持倉現價嘅變化 · {periodLabel(report)}</p>
        </section>
        <section className="card">
          <div className="meta muted">Dietz</div>
          <div className={`display ${percentClass(report.book.dietzPercent)}`}>
            {formatDietzPercent(report.book.dietzPercent)}
          </div>
          <p className="metric-sub">按入金/出金時間加權 · 短過一年，唔顯示年化</p>
        </section>
      </div>

      {showPrincipal && !emptyBook ? (
        <p className="meta muted">
          對本金（非主數字）：
          {Number(report.book.startNavUsd) > 0
            ? formatDietzPercent(
                ((Number(report.book.periodPnlUsd) / Number(report.book.startNavUsd)) * 100).toFixed(8),
              )
            : "—"}
        </p>
      ) : null}

      {showOld ? (
        <p className="meta muted">
          舊表淨盈虧（對照，無寫入帳簿）：{report.oldSheetPnlUsd ? signedMoney(report.oldSheetPnlUsd) : "無舊表數字"}
        </p>
      ) : null}

      <div className="returns-split">
        <section className="card stack">
          <div className="row">
            <h2 className="title">累積%</h2>
            <div className="submit-row">
              {report.members.map((member, index) => (
                <span key={member.memberId} className="meta" style={{ color: memberColor(index) }}>
                  {member.displayName}
                </span>
              ))}
            </div>
          </div>
          <p className="meta muted">聯名已按買入日比例拆入各人曲線</p>
          <ReturnsChart members={report.members} plotMode={report.plotMode} />
          <p className="meta muted">
            Y 係{report.plotMode === "percent" ? "累積 Dietz%" : report.plotMode === "usd" ? "期間 $" : "不足"} ·
            線旁註期間 $
          </p>
        </section>
        <section className="card">
          <h2 className="title">各人</h2>
          <p className="meta muted">同一期間</p>
          <table className="table">
            <thead>
              <tr>
                <th>人</th>
                <th>期間 $</th>
                <th>Dietz</th>
              </tr>
            </thead>
            <tbody>
              {report.members.map((member) => (
                <tr key={member.memberId}>
                  <td>{member.displayName}</td>
                  <td className="tabular">{signedShort(member.periodPnlUsd)}</td>
                  <td className="tabular">{formatDietzPercent(member.dietzPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="meta muted" style={{ marginTop: 12 }}>
            聯名倉按買入日比例拆入各人，係平行個人倉。Wah 永遠唔入聯名拆帳。
          </p>
        </section>
      </div>

      <p className="footer-note">
        平均資本≈0 或缺期初價：% 顯示 —，圖改畫 $ 或標「不足」。空白新表唔顯示「對本金」。
      </p>
      </>
      )}
    </div>
  );
}

function periodLabel(report: ReturnsReport): string {
  if (report.periodKey === "1m") {
    return "近 1 月";
  }
  if (report.periodKey === "3m") {
    return "近 3 月";
  }
  if (report.periodKey === "ytd") {
    return "今年";
  }
  return `${report.periodStart}–${report.periodEnd}`;
}

function percentClass(value: string | null): string {
  if (value == null) {
    return "muted";
  }
  return Number(value) < 0 ? "down" : "up";
}

function signedShort(value: string): string {
  const n = Number(value);
  const body = formatMoney(value, 0);
  if (n > 0) {
    return `+${body}`;
  }
  return body;
}

function ReturnsChart({
  members,
  plotMode,
}: {
  members: MemberReturn[];
  plotMode: ReturnsReport["plotMode"];
}) {
  const width = 640;
  const height = 280;
  const pad = { l: 40, r: 88, t: 16, b: 28 };
  const series = useMemo(() => {
    return members.map((member) =>
      member.points.map((point) => ({
        date: point.date,
        value: plotMode === "percent" && point.percent != null ? Number(point.percent) : Number(point.periodPnlUsd),
        label: `${formatDietzPercent(point.percent)} · ${signedShort(point.periodPnlUsd)}`,
      })),
    );
  }, [members, plotMode]);

  const dates = members[0]?.points.map((point) => point.date) ?? [];
  const values = series.flatMap((row) => row.map((point) => point.value));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (index: number) => pad.l + (dates.length <= 1 ? innerW / 2 : (index / (dates.length - 1)) * innerW);
  const y = (value: number) => pad.t + ((max - value) / span) * innerH;

  if (plotMode === "insufficient" && values.every((value) => value === 0)) {
    return <div className="kline-empty">不足</div>;
  }

  return (
    <svg className="returns-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <line x1={pad.l} y1={y(0)} x2={width - pad.r} y2={y(0)} stroke="var(--border)" />
      {series.map((row, seriesIndex) => {
        const d = row
          .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`)
          .join(" ");
        const last = row.at(-1);
        return (
          <g key={members[seriesIndex].memberId}>
            <path d={d} fill="none" stroke={memberColor(seriesIndex)} strokeWidth="1.6" />
            {last ? (
              <text x={width - pad.r + 6} y={y(last.value) + 4} fill={memberColor(seriesIndex)} fontSize="11">
                {last.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {dates.filter((_, index) => index === 0 || index === dates.length - 1 || index === Math.floor(dates.length / 2)).map((date) => {
        const index = dates.indexOf(date);
        return (
          <text key={date} x={x(index)} y={height - 8} fill="var(--muted)" fontSize="10" textAnchor="middle">
            {date.slice(5).replace("-", "/")}
          </text>
        );
      })}
    </svg>
  );
}
