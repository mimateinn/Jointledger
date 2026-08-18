export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/holdings" && (pathname === "/instrument" || pathname.startsWith("/instrument/"))) {
    return true;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const desktopNav = [
  { href: "/overview", label: "總覽", key: "overview" },
  { href: "/holdings", label: "持倉", key: "holdings" },
  { href: "/entry", label: "記一筆", key: "entry" },
  { href: "/returns", label: "收益率", key: "returns" },
  { href: "/ledger", label: "流水", key: "ledger" },
  { href: "/account", label: "帳戶", key: "account" },
] as const;

export const mobileNav = [
  { href: "/overview", label: "總覽", key: "overview" },
  { href: "/holdings", label: "持倉", key: "holdings" },
  { href: "/entry", label: "記一筆", key: "entry" },
  { href: "/returns", label: "收益率", key: "returns" },
  { href: "/ledger", label: "流水", key: "ledger" },
  { href: "/account", label: "帳戶", key: "account" },
] as const;
