"use client";

import { Icon } from "./icons";

const COPY = {
  retry: "再試",
};

export function FailurePanel({
  sentence,
  onRetry,
}: {
  sentence: string;
  onRetry: () => void;
}) {
  return (
    <div className="card state-panel state-panel-error" role="alert">
      <Icon name="warning" />
      <p>{sentence}</p>
      <div className="state-actions">
        <button className="btn btn-primary btn-refresh" type="button" onClick={onRetry}>
          <Icon name="refresh" size={16} />
          {COPY.retry}
        </button>
      </div>
    </div>
  );
}
