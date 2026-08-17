"use client";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page-center">
      <div className="card stack login-card" role="alert">
        <p className="body">呢頁暫時載唔到，唔好緊，再試一次就得。</p>
        <button className="btn btn-primary" type="button" onClick={reset}>
          再試
        </button>
      </div>
    </div>
  );
}
