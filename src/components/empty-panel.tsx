import Link from "next/link";

export function EmptyPanel({
  sentence,
  href = "/entry",
  actionLabel = "記一筆",
}: {
  sentence: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <section className="card stack">
      <p className="body">{sentence}</p>
      <div>
        <Link href={href} prefetch className="btn btn-primary">
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}
