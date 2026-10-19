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

export const JOINT_HOLDER_TOKENS = ["F", "Joint", "聯名", "聯名倉", "__joint__"] as const;

export type ResolvedHolder = {
  own: string;
  book: BookKind;
  memberName: string;
  role: "cash" | "trade";
};

export type HolderResolve =
  | { ok: true; holder: ResolvedHolder }
  | { ok: false; reason: "empty" | "unknown" | "ambiguous" };

const LETTER_BOOK: Record<string, BookKind> = {
  hey: "hey",
  sze: "sze",
  wah: "wah",
};

export function normalizeOwn(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 1);
}

export function classifyTransInfoBook(own: string): BookKind | null {
  const resolved = resolveHolder(own, []);
  return resolved.ok ? resolved.holder.book : null;
}

export function bookForMemberName(name: string): BookKind {
  return LETTER_BOOK[name.trim().toLowerCase()] ?? "personal";
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

function isJointAlias(raw: string): boolean {
  const trimmed = raw.trim();
  return JOINT_HOLDER_TOKENS.some((token) => token.toLowerCase() === trimmed.toLowerCase());
}

/** Pick a joint token that does not collide with any member display name. */
export function jointHolderToken(memberNames: readonly string[]): string {
  const taken = new Set(memberNames.map((name) => name.trim()));
  const takenLower = new Set(memberNames.map((name) => name.trim().toLowerCase()));
  for (const token of JOINT_HOLDER_TOKENS) {
    if (!taken.has(token) && !takenLower.has(token.toLowerCase())) {
      return token;
    }
  }
  return "__joint__";
}

/**
 * Resolve a holder/own cell. Exact member names win over letter codes and joint aliases.
 * Never maps an unknown or empty value to Hey.
 */
export function resolveHolder(raw: string, knownMembers: readonly string[]): HolderResolve {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty" };
  }

  const exact = knownMembers.filter((name) => name.trim() === trimmed);
  if (exact.length > 1) {
    return { ok: false, reason: "ambiguous" };
  }
  if (exact.length === 1) {
    const memberName = exact[0].trim();
    return {
      ok: true,
      holder: {
        own: trimmed,
        book: bookForMemberName(memberName),
        memberName,
        role: "cash",
      },
    };
  }

  const lower = trimmed.toLowerCase();
  const ci = knownMembers.filter((name) => name.trim().toLowerCase() === lower);
  if (ci.length > 1) {
    return { ok: false, reason: "ambiguous" };
  }
  if (ci.length === 1) {
    const memberName = ci[0].trim();
    return {
      ok: true,
      holder: {
        own: trimmed,
        book: bookForMemberName(memberName),
        memberName,
        role: "cash",
      },
    };
  }

  if (isJointAlias(trimmed)) {
    return {
      ok: true,
      holder: { own: trimmed, book: "joint", memberName: "", role: "trade" },
    };
  }

  if (trimmed.length === 1) {
    const mapped = ACCOUNT_OWN[trimmed.toUpperCase()];
    if (mapped) {
      return {
        ok: true,
        holder: { own: trimmed.toUpperCase(), book: mapped.book, memberName: mapped.memberName, role: mapped.role },
      };
    }
  }

  if (lower === "hey" || lower === "sze" || lower === "wah") {
    const memberName = canonicalMemberName(trimmed);
    return {
      ok: true,
      holder: {
        own: trimmed,
        book: bookForMemberName(memberName),
        memberName,
        role: "cash",
      },
    };
  }

  return { ok: false, reason: "unknown" };
}

/** Cash-sheet own cell: always the display name. Letter codes are import-only (legacy). */
export function cashOwnForMember(name: string): string {
  return name.trim();
}

/** Trade-sheet own cell: display name, or the non-colliding joint token. */
export function tradeOwnForAccount(
  accountKind: string | undefined,
  memberName: string | undefined,
  jointToken = "F",
): string {
  if (accountKind === "joint") {
    return jointToken;
  }
  return memberName?.trim() ?? "";
}

export function ownAccountLabel(own: string, book: BookKind): string {
  if (book === "joint") {
    return "聯名";
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
    return [];
  }
  return memberName?.trim() ? [memberName.trim()] : [];
}
