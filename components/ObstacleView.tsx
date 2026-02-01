/**
 * Engel görünümü – resimlerden (constants/obstacles.ts).
 * Yeni engel: OBSTACLE_IMAGES + OBSTACLE_LIST'e ekle.
 */

import React from 'react';
import {View, Image, StyleSheet} from 'react-native';
import { OBSTACLE_IMAGES, getObstacleById } from '../constants/obstacles';

export type ObstacleSpawn = {
  id: string;
  kind: 'obstacle';
  itemId: string;
  worldX: number;
  worldY: number;
  /** Kaya 2–3×, ağaç 1–1.25× rastgele ölçek */
  scaleFactor?: number;
};

type Props = {
  spawn: ObstacleSpawn;
  /** Karakter/engel küçültme (örn. 1/3); çarpışma ile aynı oranda kullanılır */
  globalScale?: number;
};

function ObstacleView({spawn, globalScale = 1}: Props): React.JSX.Element | null {
  const entry = getObstacleById(spawn.itemId);
  if (!entry) return null;

  const scale = (spawn.scaleFactor ?? 1) * globalScale;
  const width = Math.round(entry.width * scale);
  const height = Math.round(entry.height * scale);
  const left = spawn.worldX - width / 2;
  const top = spawn.worldY - height;

  if (spawn.itemId === 'snow-bank') {
    return (
      <View
        style={[
          styles.obstacleImage,
          styles.snowBank,
          { left, top, width, height },
        ]}
      />
    );
  }

  const source = OBSTACLE_IMAGES[spawn.itemId];
  if (!source) return null;
  return (
    <Image
      source={source}
      style={[styles.obstacleImage, { left, top, width, height }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  obstacleImage: {
    position: 'absolute',
  },
  snowBank: {
    backgroundColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
});

export default ObstacleView;
