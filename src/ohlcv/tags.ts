import type { CanonInstrument } from "@/quotes/types";

export function instrumentTags(instrument: CanonInstrument): string[] {
  switch (instrument.display) {
    case "HSI":
      return ["恒生指數", "港股", "指數"];
    case "XAU/USD":
      return ["黃金", "商品"];
    case "N225":
      return ["日經", "指數"];
    case "KS11":
      return ["KOSPI", "指數"];
    case "FTSE":
      return ["富時", "指數"];
    case "BTC/USD":
      return ["比特幣", "加密"];
    case "EUR/USD":
    case "USD/HKD":
      return ["外匯"];
    default:
      break;
  }
  if (instrument.assetClass === "equity") {
    return instrument.market === "US" ? ["美股", "股票"] : ["股票"];
  }
  if (instrument.assetClass === "etf") {
    return ["ETF"];
  }
  if (instrument.assetClass === "index") {
    return ["指數"];
  }
  if (instrument.assetClass === "commodity") {
    return ["商品"];
  }
  if (instrument.assetClass === "crypto") {
    return ["加密"];
  }
  if (instrument.assetClass === "fx") {
    return ["外匯"];
  }
  return [];
}
