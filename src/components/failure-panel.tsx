"use client";

export function FailurePanel({
  sentence,
  onRetry,
}: {
  sentence: string;
  onRetry: () => void;
}) {
  return (
    <div className="card stack" role="alert">
      <p className="body">{sentence}</p>
      <div>
        <button className="btn btn-primary" type="button" onClick={onRetry}>
          再試
        </button>
      </div>
    </div>
  );
}
