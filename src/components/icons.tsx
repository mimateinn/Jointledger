import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconOverview(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
    </svg>
  );
}

export function IconHoldings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="7" width="8" height="7" rx="1" />
      <path d="M6 7V5.5a2 2 0 0 1 4 0V7" />
    </svg>
  );
}

export function IconEntry(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M8 5.5v5M5.5 8h5" />
    </svg>
  );
}

export function IconReturns(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11.5 7 7l2.5 2.5L13 5" />
      <path d="M9.5 5H13v3.5" />
    </svg>
  );
}

export function IconLedger(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 4.5h10M3 8h10M3 11.5h10" />
    </svg>
  );
}

export function IconAccount(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="5.5" r="2.2" />
      <path d="M3.5 13c.6-2.4 2.3-3.5 4.5-3.5s3.9 1.1 4.5 3.5" />
    </svg>
  );
}
