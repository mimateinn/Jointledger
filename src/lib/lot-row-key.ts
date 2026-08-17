/** One joint trade writes one lot per member; tradeId alone collides. */
export function lotRowKey(lot: { tradeId: string; memberId: string }): string {
  return `${lot.tradeId}:${lot.memberId}`;
}
