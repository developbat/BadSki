/**
 * Sınırlı kayak yolu – prosedürel path (Y sonsuz, X yumuşak virajlar).
 * Oyun başında kullanılacak: path merkezi, min/max X, minimap için örneklenmiş noktalar.
 *
 * İsteğe bağlı: Harita JSON ile önceden hazırlanabilir; format örn.
 * { points: [{ scrollPx: number, centerX: number }], halfWidthPx: number }
 * ile path merkezi ve genişlik verilir, getPathCenterXPx benzeri interpolasyon kullanılır.
 */

import type { PathPoint } from './missions';
import { SCROLL_TO_METERS } from './missions';

/** Yol = ekran genişliği; sınırlar ekranın en sol ve en sağı. Path ekrana sığar, kıvrılınca yol kıvrılır. */
export function getTrackHalfWidthPx(screenWidth: number): number {
  return screenWidth / 2;
}

/** Prosedürel path – keskin virajlar (dönmezsen sınıra çarparsın) */
const PATH_AMPLITUDE_1 = 95;
const PATH_AMPLITUDE_2 = 65;
const PATH_PERIOD_1 = 420;
const PATH_PERIOD_2 = 280;

export function getProceduralPathCenterWorldX(
  scrollPx: number,
  screenWidth: number
): number {
  const center = screenWidth / 2;
  const x =
    center +
    PATH_AMPLITUDE_1 * Math.sin(scrollPx / PATH_PERIOD_1) +
    PATH_AMPLITUDE_2 * Math.sin(scrollPx / PATH_PERIOD_2);
  return x;
}

/** Verilen scroll'da yol sınırları (world X). */
export function getTrackBoundsAtScroll(
  scrollPx: number,
  screenWidth: number
): { minX: number; maxX: number; centerX: number } {
  const centerX = getProceduralPathCenterWorldX(scrollPx, screenWidth);
  const half = getTrackHalfWidthPx(screenWidth);
  return {
    centerX,
    minX: centerX - half,
    maxX: centerX + half,
  };
}

/** Minimap ve off-path için: prosedürel path'i örnekle (PathPoint[]). */
export function getProceduralPathPoints(
  maxScrollPx: number,
  sampleEveryPx: number,
  screenWidth: number
): PathPoint[] {
  const points: PathPoint[] = [{ distanceMeters: 0, xPx: 0 }];
  const centerOffset = screenWidth / 2; // path center offset for minimap xPx
  for (let scroll = sampleEveryPx; scroll <= maxScrollPx; scroll += sampleEveryPx) {
    const centerX = getProceduralPathCenterWorldX(scroll, screenWidth);
    const distanceMeters = scroll * SCROLL_TO_METERS;
    const xPx = centerX - centerOffset;
    points.push({ distanceMeters, xPx });
  }
  return points;
}
