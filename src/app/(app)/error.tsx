"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card stack" role="alert">
      <p className="body">呢頁暫時載唔到，唔好緊，再試一次就得。</p>
      <div>
        <button className="btn btn-primary" type="button" onClick={reset}>
          再試
        </button>
      </div>
    </div>
  );
}
