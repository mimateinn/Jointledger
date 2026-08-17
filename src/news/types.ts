export type NewsItem = {
  headline: string;
  datetime: number;
  source: string;
  url: string;
};

export type NewsCategory = "general" | "forex" | "crypto";
