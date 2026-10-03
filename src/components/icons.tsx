import type { SVGProps } from "react";
import catalog from "../../public/icons/icons-paths.json";

export type IconName = keyof typeof catalog;
export type IconSize = 16 | 20 | 24 | 48 | 64;

type IconProps = SVGProps<SVGSVGElement> & {
  size?: IconSize;
};

type PathRole = "stroke" | "dot" | "accent" | "faint";

function pathRoleProps(role: PathRole) {
  if (role === "dot") {
    return { fill: "currentColor", stroke: "none" as const };
  }
  if (role === "faint") {
    return { opacity: 0.22 };
  }
  if (role === "accent") {
    return { style: { fill: "var(--icon-accent)" }, stroke: "none" as const };
  }
  return {};
}

function sizeClass(size: IconSize, vb: number): string {
  if (vb >= 64) {
    return "icon icon-ill";
  }
  return `icon icon-${size}`;
}

export function Icon({
  name,
  size = 20,
  className,
  ...props
}: IconProps & { name: IconName }) {
  const def = catalog[name];
  const vb = def.vb;
  const classes = [sizeClass(size, vb), className].filter(Boolean).join(" ");
  return (
    <svg
      className={classes}
      viewBox={`0 0 ${vb} ${vb}`}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {def.paths.map((path, index) => (
        <path key={index} d={path.d} {...pathRoleProps(path.role as PathRole)} />
      ))}
    </svg>
  );
}

export function IconOverview(props: IconProps) {
  return <Icon name="overview" {...props} />;
}

export function IconHoldings(props: IconProps) {
  return <Icon name="holdings" {...props} />;
}

export function IconEntry(props: IconProps) {
  return <Icon name="entry" {...props} />;
}

export function IconReturns(props: IconProps) {
  return <Icon name="returns" {...props} />;
}

export function IconLedger(props: IconProps) {
  return <Icon name="ledger" {...props} />;
}

export function IconAccount(props: IconProps) {
  return <Icon name="account" {...props} />;
}

export const ICON_NAMES = [
  "overview",
  "holdings",
  "entry",
  "returns",
  "ledger",
  "account",
  "add",
  "close",
  "delete-trash",
  "edit",
  "undo",
  "upload-import",
  "download",
  "export-sheet",
  "link-sheet",
  "share",
  "logout",
  "expand",
  "collapse",
  "copy",
  "more-horizontal",
  "chevron-left",
  "chevron-right",
  "chevron-up",
  "chevron-down",
  "arrow-up-right",
  "search",
  "filter",
  "sort",
  "calendar",
  "clock-delay",
  "refresh",
  "check-update",
  "sync",
  "loading",
  "info",
  "warning",
  "error",
  "success-check",
  "help",
  "offline",
  "lock",
  "eye",
  "eye-off",
  "key-ai",
  "theme-sun",
  "theme-moon",
  "language",
  "user",
  "users-joint",
  "member-add",
  "coin-usd",
  "hkd",
  "percent",
  "chart-line",
  "chart-candle",
  "indicator",
  "news",
  "watch",
  "bell",
  "tag",
  "target",
  "print",
  "empty-ledger",
  "empty-holdings",
  "empty-watch"
] as const satisfies readonly IconName[];
