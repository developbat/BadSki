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
};

function ObstacleView({spawn}: Props): React.JSX.Element | null {
  const entry = getObstacleById(spawn.itemId);
  const source = OBSTACLE_IMAGES[spawn.itemId];
  if (!entry || !source) return null;

  const scale = spawn.scaleFactor ?? 1;
  const width = Math.round(entry.width * scale);
  const height = Math.round(entry.height * scale);
  return (
    <Image
      source={source}
      style={[
        styles.obstacleImage,
        {
          left: spawn.worldX - width / 2,
          top: spawn.worldY - height,
          width,
          height,
        },
      ]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  obstacleImage: {
    position: 'absolute',
  },
});

export default ObstacleView;
