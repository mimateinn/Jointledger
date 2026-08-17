"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconAccount,
  IconEntry,
  IconHoldings,
  IconLedger,
  IconOverview,
  IconReturns,
} from "./icons";
import { desktopNav, isNavActive, mobileNav } from "./nav-config";

const icons = {
  overview: IconOverview,
  holdings: IconHoldings,
  entry: IconEntry,
  returns: IconReturns,
  ledger: IconLedger,
  account: IconAccount,
};

export function AppChrome({
  tape,
  children,
}: {
  tape?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    for (const item of desktopNav) {
      router.prefetch(item.href);
    }
  }, [router]);

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
                const active = isNavActive(pathname, item.href);
                const pending = pendingHref === item.href && !active;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      className={active || pending ? "nav-item nav-item-active" : "nav-item"}
                      aria-current={active ? "page" : undefined}
                      aria-busy={pending}
                      onClick={() => {
                        if (!active) {
                          setPendingHref(item.href);
                        }
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <main className="main">{children}</main>
        <nav className="mobile-bar" aria-label="手機導覽">
          {mobileNav.map((item) => {
            const Icon = icons[item.key];
            const active = isNavActive(pathname, item.href);
            const pending = pendingHref === item.href && !active;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={active || pending ? "active" : undefined}
                aria-current={active ? "page" : undefined}
                aria-busy={pending}
                onClick={() => {
                  if (!active) {
                    setPendingHref(item.href);
                  }
                }}
              >
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
