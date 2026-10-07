export const DIVIDEND_NOTE_PREFIX = "股息";

export function isDividendNote(note: string | null | undefined): boolean {
  const text = (note ?? "").trim();
  return text === DIVIDEND_NOTE_PREFIX || text.startsWith(`${DIVIDEND_NOTE_PREFIX} `);
}

export function dividendNote(detail?: string | null): string {
  const extra = (detail ?? "").trim();
  if (!extra || extra === DIVIDEND_NOTE_PREFIX) {
    return DIVIDEND_NOTE_PREFIX;
  }
  if (isDividendNote(extra)) {
    return extra;
  }
  return `${DIVIDEND_NOTE_PREFIX} ${extra}`;
}
