import Link from "next/link";

export function EmptyPanel({
  title,
  body,
  href = "/entry",
  actionLabel = "記一筆",
}: {
  title: string;
  body: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <section className="card stack">
      <h2 className="title">{title}</h2>
      <p className="muted">{body}</p>
      <div>
        <Link href={href} prefetch className="btn btn-primary">
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}
