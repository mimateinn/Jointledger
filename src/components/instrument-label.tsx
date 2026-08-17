export function InstrumentLabel({
  ticker,
  name,
}: {
  ticker: string;
  name?: string | null;
}) {
  const title = name ? `${name} ${ticker}` : ticker;
  return (
    <span className="instrument-label" title={title}>
      {name ? <span className="instrument-name">{name}</span> : null}
      <span className="instrument-ticker">{ticker}</span>
    </span>
  );
}
