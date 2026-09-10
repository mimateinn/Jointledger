/** One joint trade writes one lot per member; tradeId alone collides. Null member → tradeId:_ */
export function lotRowKey(lot: { tradeId: string; memberId?: string | null }): string {
  return `${lot.tradeId}:${lot.memberId ?? "_"}`;
}
