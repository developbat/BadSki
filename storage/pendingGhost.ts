/**
 * Oyun başı hayalet süresi – sadece bellekte, AsyncStorage yok.
 * Yükseltmelerden satın alınınca set edilir, oyun başında consume edilir.
 */

let pendingGhostSeconds = 0;

export function getPendingGhostSeconds(): number {
  return pendingGhostSeconds;
}

export function setPendingGhostSeconds(seconds: number): void {
  pendingGhostSeconds = Math.max(0, seconds);
}

export function consumePendingGhost(): number {
  const s = pendingGhostSeconds;
  pendingGhostSeconds = 0;
  return s;
}
