/**
 * Mini-map: güzergah (path) ve mevcut konum.
 * Mission varken sol üstte gösterilir. Path dışındayken kırmızı yanıp söner.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { Mission } from '../constants/missions';
import { getPathCenterXPx } from '../constants/missions';

/** Dik mini harita: genişlik dar (path sola-sağa), yükseklik gidiş yönü (aşağı=başlangıç, yukarı=hedef) */
const MAP_WIDTH = 44;
const MAP_HEIGHT = 130;

type Props = {
  mission: Mission;
  distanceTraveledMeters: number;
  isOffPath?: boolean;
  /** Çok dilli senaryo adı (t('scenario_' + mission.scenarioId)) */
  scenarioLabel?: string;
};

function MiniMap({ mission, distanceTraveledMeters, isOffPath = false, scenarioLabel }: Props): React.JSX.Element {
  const label = scenarioLabel ?? mission.scenarioId;
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isOffPath) {
      flashAnim.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isOffPath, flashAnim]);

  const backgroundColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(15, 23, 42, 0.45)', 'rgba(220, 38, 38, 0.5)'],
  });
  const totalM = mission.distanceMeters;
  const progress = totalM <= 0 ? 0 : Math.min(1, distanceTraveledMeters / totalM);
  const points = mission.points;
  if (points.length < 2) {
    return (
      <Animated.View
        style={[
          styles.container,
          isOffPath && { borderColor: 'rgba(220, 38, 38, 0.9)', borderWidth: 2 },
          isOffPath && { backgroundColor },
        ]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.km}>
          {(distanceTraveledMeters / 1000).toFixed(1)} / {(totalM / 1000).toFixed(1)} km
        </Text>
      </Animated.View>
    );
  }

  const maxD = points[points.length - 1].distanceMeters;
  const maxAbsX = Math.max(1, ...points.map((p) => Math.abs(p.xPx)));
  const scaleX = (MAP_WIDTH * 0.35) / maxAbsX;

  /** Dik harita: y mesafe (aşağı=0, yukarı=hedef), x path sola-sağa */
  const pathSegments: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const y0 = (1 - a.distanceMeters / maxD) * MAP_HEIGHT;
    const y1 = (1 - b.distanceMeters / maxD) * MAP_HEIGHT;
    pathSegments.push({
      x0: MAP_WIDTH / 2 + a.xPx * scaleX,
      y0,
      x1: MAP_WIDTH / 2 + b.xPx * scaleX,
      y1,
    });
  }

  const currentPathX = getPathCenterXPx(distanceTraveledMeters, points);
  const dotY = (1 - progress) * MAP_HEIGHT;
  const dotX = MAP_WIDTH / 2 + currentPathX * scaleX;

  return (
    <Animated.View
      style={[
        styles.container,
        isOffPath && { borderColor: 'rgba(220, 38, 38, 0.9)', borderWidth: 2 },
        isOffPath && { backgroundColor },
      ]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.map}>
        {pathSegments.map((seg, i) => {
          const dx = seg.x1 - seg.x0;
          const dy = seg.y1 - seg.y0;
          const len = Math.hypot(dx, dy) || 1;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const cx = (seg.x0 + seg.x1) / 2;
          const cy = (seg.y0 + seg.y1) / 2;
          return (
            <View
              key={i}
              style={[
                styles.segment,
                {
                  left: cx - len / 2,
                  top: cy - 1,
                  width: len,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}
        <View
          style={[
            styles.dot,
            {
              left: Math.max(0, Math.min(MAP_WIDTH - 6, dotX - 3)),
              top: Math.max(0, Math.min(MAP_HEIGHT - 6, dotY - 3)),
            },
          ]}
        />
        {/* Yukarı = hedef yönü göstergesi */}
        <View style={styles.topNotch} />
      </View>
      <Text style={styles.km}>
        {(distanceTraveledMeters / 1000).toFixed(1)} / {(totalM / 1000).toFixed(1)} km
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    top: 48,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.35)',
    zIndex: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  map: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  topNotch: {
    position: 'absolute',
    top: 2,
    left: MAP_WIDTH / 2 - 3,
    width: 6,
    height: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
  },
  segment: {
    position: 'absolute',
    height: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.7)',
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    borderWidth: 1,
    borderColor: '#fff',
  },
  km: {
    fontSize: 10,
    color: '#cbd5e1',
    marginTop: 4,
  },
});

export default MiniMap;
