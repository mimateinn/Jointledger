import { MEMBER_HEY, MEMBER_SZE, MEMBER_WAH } from "./canon";
import type { BookKind } from "./types";

export const ACCOUNT_OWN: Record<string, { book: BookKind; memberName: string; role: "cash" | "trade" }> = {
  H: { book: "hey", memberName: MEMBER_HEY, role: "cash" },
  S: { book: "sze", memberName: MEMBER_SZE, role: "cash" },
  W: { book: "wah", memberName: MEMBER_WAH, role: "cash" },
  B: { book: "hey", memberName: MEMBER_HEY, role: "trade" },
  F: { book: "joint", memberName: MEMBER_HEY, role: "trade" },
  D: { book: "wah", memberName: MEMBER_WAH, role: "trade" },
  A: { book: "sze", memberName: MEMBER_SZE, role: "trade" },
};

/** TransInfo writes B+F as H, D = Wah, A = Sze. */
export const TRANSINFO_OWN: Record<string, { letter: string; fallback: BookKind; memberName: string }> = {
  H: { letter: "H", fallback: "hey", memberName: MEMBER_HEY },
  B: { letter: "B", fallback: "hey", memberName: MEMBER_HEY },
  F: { letter: "F", fallback: "joint", memberName: MEMBER_HEY },
  D: { letter: "D", fallback: "wah", memberName: MEMBER_WAH },
  A: { letter: "A", fallback: "sze", memberName: MEMBER_SZE },
  S: { letter: "S", fallback: "sze", memberName: MEMBER_SZE },
  W: { letter: "W", fallback: "wah", memberName: MEMBER_WAH },
};

export function normalizeOwn(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 1);
}

export function classifyTransInfoBook(own: string, _buyDate: string): BookKind | null {
  const key = normalizeOwn(own);
  const mapped = TRANSINFO_OWN[key];
  if (!mapped) {
    return null;
  }
  if (mapped.letter === "D" || key === "W") {
    return "wah";
  }
  if (mapped.letter === "A" || key === "S") {
    return "sze";
  }
  if (mapped.letter === "F") {
    return "joint";
  }
  return mapped.fallback;
}

export function ownAccountLabel(own: string, book: BookKind): string {
  if (book === "joint") {
    return "聯名（Hey + Sze）";
  }
  if (book === "hey") {
    return own === "B" ? "Hey 獨倉" : "Hey";
  }
  if (book === "sze") {
    return own === "A" ? "Sze 獨倉" : "Sze";
  }
  return own === "D" ? "Wah 獨倉" : "Wah";
}

export function membersForBook(book: BookKind): string[] {
  if (book === "joint") {
    return [MEMBER_HEY, MEMBER_SZE];
  }
  if (book === "hey") {
    return [MEMBER_HEY];
  }
  if (book === "sze") {
    return [MEMBER_SZE];
  }
  return [MEMBER_WAH];
}
