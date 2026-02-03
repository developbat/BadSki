/**
 * İyi ve kötü random objeler – emoji, etki, çıkma yüzdesi
 * Komik ve eğlenceli liste
 */

export type GoodItemId =
  | 'rocket'
  | 'ghost'
  | 'shield'
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
  | 'spider'
  | 'bomb';

export type CollectibleKind = 'good' | 'bad' | 'obstacle';

export interface GoodItemDef {
  id: GoodItemId;
  emoji: string;
  name: string;
  /** İkon + matematiksel açıklama (popup’ta gösterilir) */
  description: string;
  weight: number;
  durationMs: number;
  points: number;
  /** super_speed = yerden alınca hâlâ anında kullanılmaz (sadece ghost); rocket/shield kutuya gider */
  effect: 'super_speed' | 'ghost' | 'speed_boost' | 'inventory_rocket' | 'inventory_shield' | null;
}

export interface BadItemDef {
  id: BadItemId;
  emoji: string;
  name: string;
  /** İkon + matematiksel açıklama (popup’ta gösterilir) */
  description: string;
  weight: number;
  durationMs: number;
  speedMultiplier: number;
  /** Puan cezası (örn. bomba: -50) */
  scorePenalty?: number;
}

// —— İYİ OBJELER (emoji, isim, description, ağırlık, süre, puan, etki) ——
export const GOOD_ITEMS: GoodItemDef[] = [
  { id: 'rocket', emoji: '🚀', name: 'Roket', description: '🚀 → ⚡×2 ×2,5 sn)', weight: 8, durationMs: 5000, points: 0, effect: 'inventory_rocket' },
  { id: 'ghost', emoji: '👻', name: 'Hayalet', description: '👻 = 👻 +5 sn', weight: 5, durationMs: 5000, points: 0, effect: 'ghost' },
  { id: 'shield', emoji: '🛡️', name: 'Kalkan', description: '🛡️ → x1 ↓💀', weight: 6, durationMs: 0, points: 0, effect: 'inventory_shield' },
  { id: 'star', emoji: '⭐', name: 'Yıldız', description: '⭐ = ⭐ + 50', weight: 12, durationMs: 0, points: 50, effect: null },
  { id: 'diamond', emoji: '💎', name: 'Elmas', description: '💎 = ⭐ + 100', weight: 4, durationMs: 0, points: 100, effect: null },
  { id: 'clover', emoji: '🍀', name: 'Yonca', description: '🍀 = ⭐ + 20', weight: 6, durationMs: 0, points: 20, effect: null },
  { id: 'fire', emoji: '🔥', name: 'Ateş', description: '🔥 = ⚡ + 40 (10 sn)', weight: 7, durationMs: 10000, points: 0, effect: 'speed_boost' },
  { id: 'mushroom', emoji: '🍄', name: 'Mantar', description: '🍄 = ⚡ + 40 (10 sn)', weight: 8, durationMs: 10000, points: 0, effect: 'speed_boost' },
  { id: 'target', emoji: '🎯', name: 'Hedef', description: '🎯 = ⭐ + 30', weight: 10, durationMs: 0, points: 30, effect: null },
];

// —— KÖTÜ OBJELER (emoji, isim, description, ağırlık, süre, hız çarpanı, puan cezası) ——
export const BAD_ITEMS: BadItemDef[] = [
  { id: 'turtle', emoji: '🐢', name: 'Kaplumbağa', description: '🐢 = ⚡ ÷ 2', weight: 10, durationMs: 0, speedMultiplier: 0.5 },
  { id: 'skull', emoji: '💀', name: 'Kuru Kafa', description: '💀 = ⚡ × 0.1', weight: 5, durationMs: 2000, speedMultiplier: 0.1 },
  { id: 'lemon', emoji: '🍋', name: 'Limon', description: '🍋 = ⚡ × 0.4', weight: 8, durationMs: 2000, speedMultiplier: 0.4 },
  { id: 'onion', emoji: '🧅', name: 'Soğan', description: '🧅 = ⚡ × 0.3', weight: 6, durationMs: 1500, speedMultiplier: 0.3 },
  { id: 'clown', emoji: '🎪', name: 'Palyaço', description: '🎪 = ⚡ × 0.6', weight: 5, durationMs: 2000, speedMultiplier: 0.6 },
  { id: 'spider', emoji: '🕷️', name: 'Örümcek', description: '🕷️ = ⚡ × 0.35', weight: 6, durationMs: 1500, speedMultiplier: 0.35 },
  { id: 'bomb', emoji: '💣', name: 'Bomba', description: '💣 = ⚡↓ ⋀ ⭐↓', weight: 6, durationMs: 0, speedMultiplier: 0.25, scorePenalty: -80 },
];

/** İyi item anlamı (formül) – description tek kaynak. */
export function getGoodItemDescription(id: string): string | undefined {
  return GOOD_ITEMS.find((i) => i.id === id)?.description;
}

/** Kötü item anlamı (formül) – description tek kaynak. */
export function getBadItemDescription(id: string): string | undefined {
  return BAD_ITEMS.find((i) => i.id === id)?.description;
}

// Spawn aralığı (px) – ne kadar sık slot açılır (büyük = daha seyrek)
export const SPAWN_INTERVAL_PX = 580;

// Sahne şansı: her slot'ta bir şey çıkma olasılığı (0–1). Bazen hiç çıkmaz.
export const SPAWN_SCENE_CHANCE = 0.55;

// Spawn şansları (taban, Lv1): toplam 100; tuzaklar (engel+kötü) ağırlıklı
export const BASE_SPAWN_CHANCE_OBSTACLE = 58;
export const BASE_SPAWN_CHANCE_GOOD = 24;
export const BASE_SPAWN_CHANCE_BAD = 18;

// Engel yan yana: aynı slot'ta 2 veya 3 engel çıkma şansı (0–1)
export const OBSTACLE_SIDE_BY_SIDE_2_CHANCE = 0.22; // %22 iki engel yan yana
export const OBSTACLE_SIDE_BY_SIDE_3_CHANCE = 0.06; // %6 üç engel yan yana

// Etki sabitleri
export const SUPER_SPEED_MULTIPLIER = 2;
export const SPEED_BOOST_ADD = 40;
