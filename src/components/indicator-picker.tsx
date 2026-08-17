"use client";

import { INDICATOR_GROUPS, INDICATORS } from "@/indicators";

export function IndicatorPicker({
  active,
  onToggle,
}: {
  active: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="indicator-groups" aria-label="技術指標">
      {INDICATOR_GROUPS.map((group) => (
        <div key={group.id} className="indicator-group">
          <span className="indicator-group-label">{group.label}</span>
          <div className="chip-row indicator-chips">
            {INDICATORS.filter((row) => row.group === group.id).map((row) => {
              const on = active.has(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  title={row.title}
                  className={on ? "chip chip-active" : "chip"}
                  aria-pressed={on}
                  onClick={() => onToggle(row.id)}
                >
                  {row.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
