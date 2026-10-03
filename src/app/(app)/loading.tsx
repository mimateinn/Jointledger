const COPY = {
  label: "載入中",
  text: "載入中…",
};

function MetricSkeleton() {
  return (
    <section className="card metric-card col-6">
      <div className="skeleton skeleton-label" />
      <div className="skeleton skeleton-metric metric-value" />
      <div className="skeleton skeleton-sub metric-sub" />
    </section>
  );
}

export default function AppLoading() {
  return (
    <div className="page" aria-busy="true" aria-label={COPY.label}>
      <span className="sr-only">{COPY.text}</span>
      <div className="page-head">
        <div className="skeleton skeleton-title" />
        <div className="chip-row">
          <div className="skeleton" style={{ width: 72, height: 32 }} />
          <div className="skeleton" style={{ width: 72, height: 32 }} />
          <div className="skeleton" style={{ width: 72, height: 32 }} />
        </div>
      </div>
      <div className="grid-12">
        <MetricSkeleton />
        <MetricSkeleton />
        <section className="card card-flush col-12">
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </section>
      </div>
    </div>
  );
}
