export function issueId(prefix: string, row: number, extra = ""): string {
  return `${prefix}-${row}${extra ? `-${extra}` : ""}`;
}
