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

export type ResolvedHolder = {
  own: string;
  book: BookKind;
  memberName: string;
  role: "cash" | "trade";
};

const JOINT_ALIASES = new Set(["f", "joint", "聯名"]);

export function normalizeOwn(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 1);
}

export function classifyTransInfoBook(own: string): BookKind | null {
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

export function bookForMemberName(name: string): BookKind {
  const key = name.trim().toLowerCase();
  if (key === "hey") {
    return "hey";
  }
  if (key === "sze") {
    return "sze";
  }
  if (key === "wah") {
    return "wah";
  }
  return "personal";
}

function canonicalMemberName(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === "hey") {
    return MEMBER_HEY;
  }
  if (key === "sze") {
    return MEMBER_SZE;
  }
  if (key === "wah") {
    return MEMBER_WAH;
  }
  return name.trim();
}

/**
 * Resolve a holder/own cell against letter codes (v0.1.12) and any listed ledger member.
 * Never maps an unknown name to Hey.
 */
export function resolveHolder(raw: string, knownMembers: readonly string[]): ResolvedHolder | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (JOINT_ALIASES.has(lower)) {
    return { own: "F", book: "joint", memberName: MEMBER_HEY, role: "trade" };
  }

  if (trimmed.length === 1) {
    const letter = trimmed.toUpperCase();
    const mapped = ACCOUNT_OWN[letter];
    if (mapped) {
      return { own: letter, book: mapped.book, memberName: mapped.memberName, role: mapped.role };
    }
    return null;
  }

  const match = knownMembers.find((name) => name.trim().toLowerCase() === lower);
  if (match) {
    const memberName = canonicalMemberName(match);
    return {
      own: trimmed,
      book: bookForMemberName(memberName),
      memberName,
      role: "cash",
    };
  }

  if (lower === "hey" || lower === "sze" || lower === "wah") {
    const memberName = canonicalMemberName(trimmed);
    return {
      own: trimmed,
      book: bookForMemberName(memberName),
      memberName,
      role: "cash",
    };
  }

  return null;
}

/** Cash-sheet own cell for a member. Unknown names keep their display name — never "H". */
export function cashOwnForMember(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === "hey") {
    return "H";
  }
  if (key === "sze") {
    return "S";
  }
  if (key === "wah") {
    return "W";
  }
  return name.trim();
}

/** Trade-sheet own cell for an account. Unknown names keep their display name — never "H"/"B". */
export function tradeOwnForAccount(accountKind: string | undefined, memberName: string | undefined): string {
  if (accountKind === "joint") {
    return "F";
  }
  const cash = memberName ? cashOwnForMember(memberName) : "";
  if (cash === "H") {
    return "B";
  }
  if (cash === "S") {
    return "A";
  }
  if (cash === "W") {
    return "D";
  }
  return memberName?.trim() || cash;
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
  if (book === "wah") {
    return own === "D" ? "Wah 獨倉" : "Wah";
  }
  return own;
}

export function membersForBook(book: BookKind, memberName?: string): string[] {
  if (book === "joint") {
    return [MEMBER_HEY, MEMBER_SZE];
  }
  if (book === "hey") {
    return [MEMBER_HEY];
  }
  if (book === "sze") {
    return [MEMBER_SZE];
  }
  if (book === "wah") {
    return [MEMBER_WAH];
  }
  return memberName?.trim() ? [memberName.trim()] : [];
}
