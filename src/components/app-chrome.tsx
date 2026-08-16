"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAccount,
  IconEntry,
  IconHoldings,
  IconLedger,
  IconOverview,
  IconReturns,
} from "./icons";
import { desktopNav, mobileNav } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";

const icons = {
  overview: IconOverview,
  holdings: IconHoldings,
  entry: IconEntry,
  returns: IconReturns,
  ledger: IconLedger,
  account: IconAccount,
};

export function AppChrome({
  displayName,
  tape,
  children,
}: {
  displayName: string;
  tape?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="app-frame">
      {tape}
      <div className="shell">
        <aside className="sidebar">
          <div className="wordmark">聯倉</div>
          <nav>
            <ul className="nav-list">
              {desktopNav.map((item) => {
                const Icon = icons[item.key];
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={active ? "nav-item nav-item-active" : "nav-item"}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="sidebar-footer">
            <ThemeToggle />
            <div className="body">{displayName}</div>
          </div>
        </aside>
        <main className="main">{children}</main>
        <nav className="mobile-bar" aria-label="手機導覽">
          {mobileNav.map((item) => {
            const Icon = icons[item.key];
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
