import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "聯倉",
  title: {
    default: "聯倉",
    template: "%s · 聯倉",
  },
  description: "多人股票記帳。純粹記帳，不連接券商。",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "聯倉",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0e1320",
  width: "device-width",
  initialScale: 1,
};

const themeBoot = `
try {
  var pref = localStorage.getItem("jl-theme") || "dark";
  var resolved = pref === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : pref;
  if (resolved !== "light" && resolved !== "dark") resolved = "dark";
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-pref", pref);
  if (localStorage.getItem("jl-reduced") === "1") {
    document.documentElement.classList.add("is-reduced");
  }
} catch (e) {
  document.documentElement.setAttribute("data-theme", "dark");
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
