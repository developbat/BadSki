/**
 * Tüm engeller tek listede – resimlerden. Yeni engel eklemek için:
 * 1. OBSTACLE_IMAGES'a require(...) ekle
 * 2. OBSTACLE_LIST'e { id, weight, width, height, description } ekle
 */

export interface ObstacleEntry {
  id: string;
  weight: number;
  width: number;
  height: number;
  description?: string;
}

/** Engel resimleri – id ile require eşleşmesi. Yeni resim ekleyince buraya require ekle. */
export const OBSTACLE_IMAGES: Record<string, ReturnType<typeof require>> = {
  'rock-small1': require('../assets/rocks/rock-small1.png'),
  'rock-small2': require('../assets/rocks/rock-small2.png'),
  'rock-small3': require('../assets/rocks/rock-small3.png'),
  'rock-big1': require('../assets/rocks/rock-big1.png'),
  'rock-big2': require('../assets/rocks/rock-big2.png'),
  'rock-big3': require('../assets/rocks/rock-big3.png'),
  'tree-small1': require('../assets/tree/tree-small1.png'),
  'tree-small2': require('../assets/tree/tree-small2.png'),
  'tree-small3': require('../assets/tree/tree-small3.png'),
  'tree-big1': require('../assets/tree/tree-big1.png'),
  'tree-big2': require('../assets/tree/tree-big2.png'),
  'tree-big3': require('../assets/tree/tree-big3.png'),
};

// Kayakçı (skier) ebatı – ağaç minimum bu kadar (120×160)
export const SKIER_WIDTH = 120;
export const SKIER_HEIGHT = 160;

/** Engel listesi – base ebatlar. Ağaç min = skier; kaya spawn'da 2–3× rastgele uygulanır. */
export const OBSTACLE_LIST: ObstacleEntry[] = [
  { id: 'rock-small1', weight: 10, width: 44, height: 44, description: '🪨 = 💥' },
  { id: 'rock-small2', weight: 10, width: 44, height: 44, description: '🪨 = 💥' },
  { id: 'rock-small3', weight: 10, width: 44, height: 44, description: '🪨 = 💥' },
  { id: 'rock-big1', weight: 10, width: 72, height: 72, description: '🪨 = 💥' },
  { id: 'rock-big2', weight: 10, width: 72, height: 72, description: '🪨 = 💥' },
  { id: 'rock-big3', weight: 10, width: 72, height: 72, description: '🪨 = 💥' },
  // Ağaç min = skier (120×160); random biraz daha büyük olabilir (scaleFactor 1–1.25)
  { id: 'tree-small1', weight: 10, width: SKIER_WIDTH, height: SKIER_HEIGHT, description: '🌲 = 💥' },
  { id: 'tree-small2', weight: 10, width: SKIER_WIDTH, height: SKIER_HEIGHT, description: '🌲 = 💥' },
  { id: 'tree-small3', weight: 10, width: SKIER_WIDTH, height: SKIER_HEIGHT, description: '🌲 = 💥' },
  { id: 'tree-big1', weight: 10, width: 150, height: 200, description: '🌲 = 💥' },
  { id: 'tree-big2', weight: 10, width: 150, height: 200, description: '🌲 = 💥' },
  { id: 'tree-big3', weight: 10, width: 150, height: 200, description: '🌲 = 💥' },
];

export function getObstacleById(id: string): ObstacleEntry | undefined {
  return OBSTACLE_LIST.find(o => o.id === id);
}
