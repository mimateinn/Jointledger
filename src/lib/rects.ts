export type Box = { top: number; right: number; bottom: number; left: number };

export function rectsOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
