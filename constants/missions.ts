/**
 * Görev / senaryo sistemi – 5 senaryo, rasgele 10–13 km, path üretimi.
 * Path’te kalırsan daha iyi; yoldan çıkarsan daha çok taş/ağaç.
 */

import scenariosJson from './scenarios.json';

export type PathSegment = {
  lengthMeters: number;
  curve: number;
};

export type PathPoint = {
  distanceMeters: number;
  /** Path merkezinin yatay ofseti (px), başlangıç 0 */
  xPx: number;
};

export type ScenarioThemeType = 'delivery' | 'chase' | 'escape' | 'survival' | 'reach';

export type ScenarioTheme = {
  id: string;
  type: ScenarioThemeType;
  icon: string;
  distanceMinM: number;
  distanceMaxM: number;
  segmentLengthMin: number;
  segmentLengthMax: number;
  curveIntensity: number;
};

type PathGenParams = Pick<
  ScenarioTheme,
  'segmentLengthMin' | 'segmentLengthMax' | 'curveIntensity'
>;

export const SCENARIO_THEMES: ScenarioTheme[] = (
  scenariosJson as { scenarios: ScenarioTheme[] }
).scenarios;

/** Path merkezinin 1 m’de ne kadar (px) kayabileceği – curve 1 iken */
const DRIFT_PX_PER_METER = 0.08;

/** Her seviye için mesafe aralığına eklenen metre (Lv1=0, Lv2=+1000, ...) */
const METERS_PER_LEVEL = 1000;

export function pickRandomDistance(theme: ScenarioTheme, level: number = 1): number {
  const extra = (level - 1) * METERS_PER_LEVEL;
  const minM = theme.distanceMinM + extra;
  const maxM = theme.distanceMaxM + extra;
  const range = maxM - minM;
  return minM + Math.floor(Math.random() * range);
}

export function generatePathSegments(
  params: PathGenParams,
  targetMeters: number
): PathSegment[] {
  const { segmentLengthMin, segmentLengthMax, curveIntensity } = params;
  const segments: PathSegment[] = [];
  let total = 0;
  while (total < targetMeters) {
    const len = Math.min(
      segmentLengthMin +
        Math.floor(Math.random() * (segmentLengthMax - segmentLengthMin)),
      targetMeters - total
    );
    if (len <= 0) break;
    const curveRoll = Math.random();
    let curve = 0;
    if (curveRoll < 0.2) curve = 0;
    else if (curveRoll < 0.5) curve = (Math.random() - 0.5) * 2 * curveIntensity;
    else curve = (Math.random() - 0.5) * 2 * curveIntensity;
    segments.push({ lengthMeters: len, curve });
    total += len;
  }
  return segments;
}

/**
 * Segment listesinden path noktaları (distanceMeters, xPx) üretir.
 * Mini-map ve path merkezi hesabı için kullanılır.
 */
export function pathSegmentsToPoints(segments: PathSegment[]): PathPoint[] {
  const points: PathPoint[] = [{ distanceMeters: 0, xPx: 0 }];
  let d = 0;
  let x = 0;
  for (const seg of segments) {
    d += seg.lengthMeters;
    x += seg.curve * seg.lengthMeters * DRIFT_PX_PER_METER;
    points.push({ distanceMeters: d, xPx: x });
  }
  return points;
}

/**
 * Verilen mesafede (m) path merkezinin yatay ofsetini (px) döndürür.
 */
export function getPathCenterXPx(
  distanceMeters: number,
  points: PathPoint[]
): number {
  if (points.length === 0) return 0;
  if (distanceMeters <= points[0].distanceMeters) return points[0].xPx;
  for (let i = 1; i < points.length; i++) {
    if (distanceMeters <= points[i].distanceMeters) {
      const a = points[i - 1];
      const b = points[i];
      const t = (distanceMeters - a.distanceMeters) / (b.distanceMeters - a.distanceMeters);
      return a.xPx + t * (b.xPx - a.xPx);
    }
  }
  return points[points.length - 1].xPx;
}

/** İleride path sola mı sağa mı dönüyor: lookAheadM kadar ilerideki path merkezi farkı (px) */
const PATH_TURN_LOOK_AHEAD_M = 400;
const PATH_TURN_THRESHOLD_PX = 18;

/**
 * Mevcut konumdan ileride path’in dönüş yönü: 'left' | 'right' | null (düz).
 */
export function getPathTurnAhead(
  distanceMeters: number,
  points: PathPoint[],
  lookAheadM: number = PATH_TURN_LOOK_AHEAD_M
): 'left' | 'right' | null {
  if (points.length < 2) return null;
  const nowX = getPathCenterXPx(distanceMeters, points);
  const aheadX = getPathCenterXPx(distanceMeters + lookAheadM, points);
  const delta = aheadX - nowX;
  if (delta > PATH_TURN_THRESHOLD_PX) return 'right';
  if (delta < -PATH_TURN_THRESHOLD_PX) return 'left';
  return null;
}

export type Mission = {
  scenarioId: string;
  distanceMeters: number;
  segments: PathSegment[];
  points: PathPoint[];
};

/**
 * Rasgele senaryo (JSON’dan) + rasgele isim + mesafe + path ile görev oluşturur.
 */
export function createRandomMission(level: number = 1): Mission {
  const theme = SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)];
  const distanceMeters = pickRandomDistance(theme, level);
  const segments = generatePathSegments(theme, distanceMeters);
  const points = pathSegmentsToPoints(segments);
  return {
    scenarioId: theme.id,
    distanceMeters,
    segments,
    points,
  };
}

/** Dönen animasyon için rasgele senaryo seçimi (theme + path önizlemesi) */
export function pickRandomThemeForRoll(level: number = 1): { theme: ScenarioTheme; points: PathPoint[] } {
  const theme = SCENARIO_THEMES[Math.floor(Math.random() * SCENARIO_THEMES.length)];
  const distanceMeters = pickRandomDistance(theme, level);
  const segments = generatePathSegments(theme, distanceMeters);
  const points = pathSegmentsToPoints(segments);
  return { theme, points };
}

/** Scroll (px) → mesafe (m) dönüşümü – GameScreen ile aynı oran */
export const SCROLL_TO_METERS = 0.1;

/** Path’ten bu kadar (px) uzaktaysan “yoldan çıkmış” sayılır; engel yoğunluğu artar */
export const OFF_PATH_THRESHOLD_PX = 90;

/** Yoldan cikinca engel sansi (0-100) */
export const SPAWN_CHANCE_OBSTACLE_OFF_PATH = 62;
