/**
 * İyi ve kötü random objeler – emoji, etki, çıkma yüzdesi
 * Komik ve eğlenceli liste
 */

export type GoodItemId =
  | 'rocket'
  | 'ghost'
  | 'star'
  | 'diamond'
  | 'clover'
  | 'fire'
  | 'mushroom'
  | 'target';

export type BadItemId =
  | 'turtle'
  | 'skull'
  | 'lemon'
  | 'onion'
  | 'clown'
  | 'spider';

export type ObstacleId = 'stone' | 'tree';

export type CollectibleKind = 'good' | 'bad' | 'obstacle';

export interface GoodItemDef {
  id: GoodItemId;
  emoji: string;
  name: string;
  /** Çıkma ağırlığı (iyi itemler arasında) */
  weight: number;
  /** Süre ms (0 = anlık) */
  durationMs: number;
  /** Puan (0 = puan vermez) */
  points: number;
  /** 'super_speed' | 'ghost' | null */
  effect: 'super_speed' | 'ghost' | 'speed_boost' | null;
}

export interface BadItemDef {
  id: BadItemId;
  emoji: string;
  name: string;
  weight: number;
  durationMs: number;
  /** Hız çarpanı (0.5 = yarıya düşür) */
  speedMultiplier: number;
}

export interface ObstacleDef {
  id: ObstacleId;
  weight: number;
}

// —— İYİ OBJELER (emoji, isim, ağırlık, süre ms, puan, etki) ——
export const GOOD_ITEMS: GoodItemDef[] = [
  { id: 'rocket', emoji: '🚀', name: 'Roket', weight: 8, durationMs: 5000, points: 0, effect: 'super_speed' },
  { id: 'ghost', emoji: '👻', name: 'Hayalet', weight: 5, durationMs: 5000, points: 0, effect: 'ghost' },
  { id: 'star', emoji: '⭐', name: 'Yıldız', weight: 12, durationMs: 0, points: 50, effect: null },
  { id: 'diamond', emoji: '💎', name: 'Elmas', weight: 4, durationMs: 0, points: 100, effect: null },
  { id: 'clover', emoji: '🍀', name: 'Yonca', weight: 6, durationMs: 0, points: 20, effect: null },
  { id: 'fire', emoji: '🔥', name: 'Ateş', weight: 7, durationMs: 3000, points: 0, effect: 'speed_boost' },
  { id: 'mushroom', emoji: '🍄', name: 'Mantar', weight: 8, durationMs: 2000, points: 0, effect: 'speed_boost' },
  { id: 'target', emoji: '🎯', name: 'Hedef', weight: 10, durationMs: 0, points: 30, effect: null },
];

// —— KÖTÜ OBJELER (emoji, isim, ağırlık, süre ms, hız çarpanı) ——
export const BAD_ITEMS: BadItemDef[] = [
  { id: 'turtle', emoji: '🐢', name: 'Kaplumbağa', weight: 10, durationMs: 0, speedMultiplier: 0.5 },
  { id: 'skull', emoji: '💀', name: 'Kuru Kafa', weight: 5, durationMs: 2000, speedMultiplier: 0.1 },
  { id: 'lemon', emoji: '🍋', name: 'Limon', weight: 8, durationMs: 2000, speedMultiplier: 0.4 },
  { id: 'onion', emoji: '🧅', name: 'Soğan', weight: 6, durationMs: 1500, speedMultiplier: 0.3 },
  { id: 'clown', emoji: '🎪', name: 'Palyaço', weight: 5, durationMs: 2000, speedMultiplier: 0.6 },
  { id: 'spider', emoji: '🕷️', name: 'Örümcek', weight: 6, durationMs: 1500, speedMultiplier: 0.35 },
];

// —— TUZAKLAR (taş, ağaç – çarpınca düş) ——
export const OBSTACLE_DEFS: ObstacleDef[] = [
  { id: 'stone', weight: 50 },
  { id: 'tree', weight: 50 },
];

// Spawn aralığı (px) – ne kadar sık slot açılır (büyük = daha seyrek)
export const SPAWN_INTERVAL_PX = 580;

// Sahne şansı: her slot'ta bir şey çıkma olasılığı (0–1). Bazen hiç çıkmaz.
export const SPAWN_SCENE_CHANCE = 0.55;

// Spawn şansları: çıktıysa hangi kategoriden (toplam 100)
export const SPAWN_CHANCE_OBSTACLE = 45;  // %45 tuzak (taş/ağaç)
export const SPAWN_CHANCE_GOOD = 35;       // %35 iyi (emoji)
export const SPAWN_CHANCE_BAD = 20;       // %20 kötü (emoji)

// Etki sabitleri
export const SUPER_SPEED_MULTIPLIER = 2;
export const SPEED_BOOST_ADD = 40;
