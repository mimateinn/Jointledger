import Link from "next/link";
import { Icon, type IconName } from "./icons";

const COPY = {
  defaultAction: "記一筆",
};

export function EmptyPanel({
  sentence,
  href = "/entry",
  actionLabel = COPY.defaultAction,
  title,
  icon = "empty-ledger",
  secondaryHref,
  secondaryLabel,
}: {
  sentence: string;
  href?: string;
  actionLabel?: string;
  title?: string;
  icon?: IconName;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="card state-panel">
      <Icon name={icon} className="icon-ill" />
      {title ? <h2>{title}</h2> : null}
      <p>{sentence}</p>
      <div className="state-actions">
        <Link href={href} prefetch className="btn btn-primary">
          {actionLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link href={secondaryHref} prefetch className="btn btn-ghost">
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
