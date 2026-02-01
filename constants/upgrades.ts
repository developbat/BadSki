/**
 * Yükseltmeler – puan ile alınan kalıcı ve oyun başı satın almalar.
 */

export const STORAGE_KEYS = {
  TOTAL_POINTS: '@badski/totalPoints',
  TOTAL_EARNED: '@badski/totalEarned',
  UPGRADES: '@badski/upgrades',
  PENDING_GHOST: '@badski/pendingGhostSeconds',
  FREE_SKI_RECORD: '@badski/freeSkiRecord',
} as const;

/** Oyun içi hız birimi: başlangıç max (50), her +5 km yükseltmesi, max 200 km */
export const BASE_MAX_SPEED = 50;
export const SPEED_UPGRADE_PER_LEVEL = 5;
export const MAX_SPEED_LEVEL = 30; // 50 + 30*5 = 200

/** Kalıcı yükseltme: hız seviyesi (0 = 50, 1 = 55, ... 30 = 200) */
export interface UpgradesState {
  speedLevel: number;
  /** Zıplama süresi seviyesi (0 = 700ms, +100ms/level, max 5 sn) */
  jumpDurationLevel: number;
  /** Satın alınan roket sayısı (oyunda kullanılır) */
  rocketStored: number;
  /** Ekstra can: çarpınca bir hak tüketilir, kaldığı yerden devam eder */
  extraLivesStored: number;
  /** İyi nesne sıklığı: her seviye +2% iyi spawn (max 5) */
  goodSpawnLevel: number;
  /** Kötü nesne azaltma: her seviye -2% kötü spawn (max 5) */
  badSpawnLevel: number;
}

export const DEFAULT_UPGRADES: UpgradesState = {
  speedLevel: 0,
  jumpDurationLevel: 0,
  rocketStored: 0,
  extraLivesStored: 0,
  goodSpawnLevel: 0,
  badSpawnLevel: 0,
};

// —— Zıplama süresi (kalıcı): +100 ms/level, max 5 sn ——
export const BASE_JUMP_DURATION_MS = 700;
export const JUMP_DURATION_BONUS_MS = 100;
export const MAX_JUMP_DURATION_MS = 5000;
export const MAX_JUMP_DURATION_LEVEL = 43; // 700 + 43*100 = 5000

export function getJumpDurationMs(level: number): number {
  const bonus = Math.min(level, MAX_JUMP_DURATION_LEVEL) * JUMP_DURATION_BONUS_MS;
  return Math.min(BASE_JUMP_DURATION_MS + bonus, MAX_JUMP_DURATION_MS);
}

export function getJumpDurationCost(level: number): number {
  if (level >= MAX_JUMP_DURATION_LEVEL) return Infinity;
  return 800 + level * 180; // Kalıcı olduğu için pahalı
}

// —— Roket (tüketilebilir, oyunda kullan) ——
export const ROCKET_COST = 200;
export const ROCKET_DURATION_MS = 5000;

/** Hız seviyesi fiyatı: kalıcı olduğu için pahalı, 200 km’ye kadar */
export function getSpeedUpgradeCost(level: number): number {
  if (level >= MAX_SPEED_LEVEL) return Infinity;
  return 600 + level * 150; // 600, 750, 900, ...
}

/** Mevcut max hız (oyun birimi) = BASE_MAX_SPEED + speedLevel * SPEED_UPGRADE_PER_LEVEL */
export function getMaxSpeedFromLevel(level: number): number {
  return BASE_MAX_SPEED + Math.min(level, MAX_SPEED_LEVEL) * SPEED_UPGRADE_PER_LEVEL;
}

// —— Kullanıcı seviyesi (toplam kazanılan puana göre) ——
/** Seviye eşikleri: Lv1=0, Lv2=1000, Lv3=3000, Lv4=9000, Lv5=27000, ... (x3) */
export function getLevelFromTotalEarned(totalEarned: number): number {
  if (totalEarned < 1000) return 1;
  let level = 1;
  let threshold = 1000;
  while (totalEarned >= threshold) {
    level += 1;
    threshold *= 3;
  }
  return level;
}

/** Bir sonraki seviye için gereken toplam kazanç */
export function getTotalEarnedForLevel(level: number): number {
  if (level <= 1) return 0;
  return 1000 * Math.pow(3, level - 2);
}

// —— Oyun başı satın almalar (bu oyun için) ——

/** Hayalet mod: oyun başında X saniye hayalet (puan ile alınır, o oyun için) */
export const GHOST_START_COST = 150;
export const GHOST_START_SECONDS = 12;

// —— Ekstra can (tüketilebilir, çarpınca bir hak gider, devam eder) ——
export const EXTRA_LIFE_COST = 450; // Yüksek puan; birden fazla satın alınabilir

// —— İyi / kötü spawn sıklığı (kalıcı, oyun getir oranlarını değiştirir) ——
export const MAX_GOOD_SPAWN_LEVEL = 5;  // +2% iyi / seviye → en fazla +10%
export const MAX_BAD_SPAWN_LEVEL = 5;   // -2% kötü / seviye → en fazla -10%

export function getGoodSpawnUpgradeCost(level: number): number {
  if (level >= MAX_GOOD_SPAWN_LEVEL) return Infinity;
  return 400 + level * 120;
}

export function getBadSpawnUpgradeCost(level: number): number {
  if (level >= MAX_BAD_SPAWN_LEVEL) return Infinity;
  return 400 + level * 120;
}
