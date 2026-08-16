import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansTc = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "聯倉",
  title: {
    default: "聯倉",
    template: "%s · 聯倉",
  },
  description: "多人股票記帳。純粹記帳，不連接券商。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "聯倉",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#121411",
  width: "device-width",
  initialScale: 1,
};

const themeBoot = `
try {
  var t = localStorage.getItem("jl-theme") || "dark";
  document.documentElement.setAttribute("data-theme", t);
} catch (e) {
  document.documentElement.setAttribute("data-theme", "dark");
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" data-theme="dark" className={`${inter.variable} ${notoSansTc.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
