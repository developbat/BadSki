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

/** Sabit yol genişliği (px). Sol/sağ sınır taşları bu genişliğin bitiminde; rota eğrilince her iki kenar da birlikte kayar, koridor daralmaz. */
export const TRACK_WIDTH_PX = 500;

/** Yol yarı genişliği – sınırlar center ± TRACK_WIDTH_PX/2; path kıvrılınca minX/maxX birlikte kıvrılır. */
export function getTrackHalfWidthPx(_screenWidth: number): number {
  return TRACK_WIDTH_PX / 2;
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

/** Path eğriliği (straight = düşük). scrollPx'te merkez, ±samplePx ile açı farkı. Düşük = düz. */
const CURVATURE_SAMPLE_PX = 80;
export function getProceduralPathCurvature(
  scrollPx: number,
  screenWidth: number
): number {
  const x0 = getProceduralPathCenterWorldX(scrollPx - CURVATURE_SAMPLE_PX, screenWidth);
  const x1 = getProceduralPathCenterWorldX(scrollPx, screenWidth);
  const x2 = getProceduralPathCenterWorldX(scrollPx + CURVATURE_SAMPLE_PX, screenWidth);
  const dx1 = x1 - x0;
  const dx2 = x2 - x1;
  const curvature = Math.abs(dx2 - dx1);
  return curvature;
}

/** Düz segment mi (eğrilik eşiğin altında). */
const STRAIGHT_CURVATURE_THRESHOLD = 8;
export function isProceduralPathStraight(
  scrollPx: number,
  screenWidth: number
): boolean {
  return getProceduralPathCurvature(scrollPx, screenWidth) < STRAIGHT_CURVATURE_THRESHOLD;
}

/** Viraj yönü: -1 sol, 0 düz, 1 sağ (kamera hafif rotasyonu için). */
const TURN_SAMPLE_PX = 60;
export function getProceduralPathTurnDirection(
  scrollPx: number,
  screenWidth: number
): number {
  const x0 = getProceduralPathCenterWorldX(scrollPx - TURN_SAMPLE_PX, screenWidth);
  const x1 = getProceduralPathCenterWorldX(scrollPx, screenWidth);
  const x2 = getProceduralPathCenterWorldX(scrollPx + TURN_SAMPLE_PX, screenWidth);
  const d2 = (x2 - x1) - (x1 - x0);
  if (Math.abs(d2) < 2) return 0;
  return Math.sign(d2);
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
