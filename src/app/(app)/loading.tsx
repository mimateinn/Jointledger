export default function AppLoading() {
  return (
    <div className="stack" aria-busy="true" aria-label="載入中">
      <div className="skeleton skeleton-title" />
      <section className="card stack">
        <div className="skeleton skeleton-nav" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
      </section>
    </div>
  );
}
