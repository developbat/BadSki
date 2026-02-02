/**
 * Oyun öncesi harita hazırlığı – spawn planı.
 * Nerede neyin çıkacağı önceden hesaplanır; oyun döngüsü sadece planı tüketir (akış düzgün, donma azalır).
 */

import type { Mission } from './missions';
import type { GoodItemId, BadItemId } from './items';
import { getPathCenterXPx } from './missions';
import { getProceduralPathCenterWorldX, getTrackHalfWidthPx } from './trackPath';
import { SCROLL_TO_METERS } from './missions';
import {
  SPAWN_INTERVAL_PX,
  SPAWN_SCENE_CHANCE,
  OBSTACLE_SIDE_BY_SIDE_2_CHANCE,
  OBSTACLE_SIDE_BY_SIDE_3_CHANCE,
  GOOD_ITEMS,
  BAD_ITEMS,
} from './items';
import { OBSTACLE_LIST_FOR_SPAWN } from './obstacles';
import { BASE_SPAWN_CHANCE_OBSTACLE, BASE_SPAWN_CHANCE_GOOD, BASE_SPAWN_CHANCE_BAD } from './items';
import { MAX_GOOD_SPAWN_LEVEL, MAX_BAD_SPAWN_LEVEL } from './upgrades';

function pickByWeight<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[0];
}

function getChances(level: number, goodSpawnLevel: number, badSpawnLevel: number) {
  const goodBonus = Math.min(goodSpawnLevel, MAX_GOOD_SPAWN_LEVEL) * 2;
  const badBonus = Math.min(badSpawnLevel, MAX_BAD_SPAWN_LEVEL) * 2;
  const levelPenalty = Math.max(0, level - 1);
  let good = Math.max(0, Math.min(100, BASE_SPAWN_CHANCE_GOOD - levelPenalty + goodBonus));
  let bad = Math.max(0, Math.min(100, BASE_SPAWN_CHANCE_BAD - levelPenalty - badBonus));
  let obstacle = 100 - good - bad;
  if (obstacle < 0) {
    obstacle = 0;
    const total = good + bad;
    if (total > 0) {
      good = Math.round((good / total) * 100);
      bad = Math.max(0, 100 - good);
    }
  }
  return { obstacle, good, bad };
}

export type SpawnKindPlan = 'obstacle' | 'good' | 'bad';

export type SpawnPlanEntry = {
  scrollPx: number;
  kind: SpawnKindPlan;
  itemId: string | GoodItemId | BadItemId;
  worldX: number;
  /** worldY = scrollOffset - SCREEN_HEIGHT + worldYOffset (tüketim anında hesaplanır) */
  worldYOffset: number;
  scaleFactor?: number;
};

/**
 * Belirtilen scroll aralığı için spawn planı üretir (engel/iyi/kötü; kar kümeleri döngüde).
 */
export function buildSpawnPlanChunk(
  startScrollPx: number,
  endScrollPx: number,
  opts: {
    mission: Mission | null;
    level: number;
    goodSpawnLevel: number;
    badSpawnLevel: number;
    screenWidth: number;
    reduceGhostRocket: boolean;
  }
): SpawnPlanEntry[] {
  const { mission, level, goodSpawnLevel, badSpawnLevel, screenWidth, reduceGhostRocket } = opts;
  const plan: SpawnPlanEntry[] = [];
  const trackHalf = getTrackHalfWidthPx(screenWidth);
  const spawnMargin = trackHalf * 0.65;
  const { obstacle: obstChance, good: goodChance, bad: badChance } = getChances(
    level,
    goodSpawnLevel,
    badSpawnLevel
  );
  const total = obstChance + goodChance + badChance;
  const goodThreshold = total > 0 ? obstChance : 0;
  const badThreshold = total > 0 ? obstChance + goodChance : 0;

  for (let scrollPx = startScrollPx; scrollPx < endScrollPx; scrollPx += SPAWN_INTERVAL_PX) {
    if (Math.random() >= SPAWN_SCENE_CHANCE) continue;

    const distM = scrollPx * SCROLL_TO_METERS;
    const pathCenterWorldX =
      mission && mission.points.length > 0
        ? screenWidth / 2 + getPathCenterXPx(distM, mission.points)
        : getProceduralPathCenterWorldX(scrollPx, screenWidth);
    const randomInTrack = () => pathCenterWorldX + (Math.random() - 0.5) * 2 * spawnMargin;

    const worldYOffset = -320 + Math.random() * 200;
    const roll = Math.random() * 100;
    if (roll < goodThreshold) {
      const goodPool = reduceGhostRocket
        ? GOOD_ITEMS.map((i) =>
            i.id === 'ghost' || i.id === 'rocket'
              ? { ...i, weight: Math.max(1, Math.floor(i.weight / 3)) }
              : i
          )
        : GOOD_ITEMS;
      const itemId = pickByWeight(goodPool).id as GoodItemId;
      plan.push({
        scrollPx: scrollPx + Math.random() * 30,
        kind: 'good',
        itemId,
        worldX: randomInTrack(),
        worldYOffset,
      });
    } else if (roll < badThreshold) {
      const itemId = pickByWeight(BAD_ITEMS).id as BadItemId;
      plan.push({
        scrollPx: scrollPx + Math.random() * 30,
        kind: 'bad',
        itemId,
        worldX: randomInTrack(),
        worldYOffset,
      });
    } else {
      const sideRoll = Math.random();
      const count = sideRoll < OBSTACLE_SIDE_BY_SIDE_3_CHANCE ? 3 : sideRoll < OBSTACLE_SIDE_BY_SIDE_2_CHANCE ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const entry = pickByWeight(OBSTACLE_LIST_FOR_SPAWN);
        const isRock = entry.id.startsWith('rock');
        const scaleFactor = isRock ? 2 + Math.random() : 1 + Math.random() * 0.25;
        const worldX =
          count === 1 ? randomInTrack() : pathCenterWorldX + (Math.random() - 0.5) * spawnMargin * 1.6;
        plan.push({
          scrollPx: scrollPx + i * 15 + Math.random() * 20,
          kind: 'obstacle',
          itemId: entry.id,
          worldX,
          worldYOffset: -320 + Math.random() * 200,
          scaleFactor,
        });
      }
    }
  }

  return plan.sort((a, b) => a.scrollPx - b.scrollPx);
}

/** Serbest kay için tek seferde üretilecek plan uzunluğu (px) – 10 km ≈ 100_000 px */
export const FREE_SKI_PLAN_PX = 100_000;

export type BuildSpawnPlanForRunOpts = {
  mission: Mission | null;
  level: number;
  goodSpawnLevel: number;
  badSpawnLevel: number;
  screenWidth: number;
  reduceGhostRocket: boolean;
};

/**
 * Oyun başlamadan önce (entry’de) tek seferde tüm harita planını üretir.
 * Mission varsa mesafe kadar; serbest kayda FREE_SKI_PLAN_PX kadar.
 * Bu plan JSON gibi oyun ekranına verilir, motor sadece tüketir (akıcı, tutarlı).
 */
export function buildSpawnPlanForRun(opts: BuildSpawnPlanForRunOpts): SpawnPlanEntry[] {
  const { mission, level, goodSpawnLevel, badSpawnLevel, screenWidth, reduceGhostRocket } = opts;
  const maxPx =
    mission && mission.points.length > 0
      ? mission.distanceMeters / SCROLL_TO_METERS
      : FREE_SKI_PLAN_PX;
  return buildSpawnPlanChunk(0, maxPx, {
    mission,
    level,
    goodSpawnLevel,
    badSpawnLevel,
    screenWidth,
    reduceGhostRocket,
  });
}
