import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "聯倉",
    short_name: "聯倉",
    description: "多人股票記帳。純粹記帳，不連接券商。",
    start_url: "/",
    display: "standalone",
    background_color: "#121411",
    theme_color: "#121411",
    lang: "zh-Hant",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
