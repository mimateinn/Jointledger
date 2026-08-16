export function DelayBadge({
  label,
  lastUpdate,
}: {
  label: string;
  lastUpdate?: string | null;
}) {
  return (
    <span className="chip chip-delay" title={lastUpdate ?? undefined}>
      {label}
      {lastUpdate ? <span className="delay-update"> · {lastUpdate}</span> : null}
    </span>
  );
}
