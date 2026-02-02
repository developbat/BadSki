/**
 * Mini-map: güzergah (path) ve mevcut konum.
 * Mission varken veya serbest kayda prosedürel path ile sol üstte gösterilir. Path dışındayken kırmızı yanıp söner.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type ViewStyle } from 'react-native';
import type { Mission } from '../constants/missions';
import type { PathPoint } from '../constants/missions';
import { getPathCenterXPx } from '../constants/missions';

/** Dik mini harita: genişlik dar (path sola-sağa), yükseklik gidiş yönü (aşağı=başlangıç, yukarı=hedef) */
const MAP_WIDTH = 44;
const MAP_HEIGHT = 130;

type Props = {
  mission: Mission | null;
  distanceTraveledMeters: number;
  isOffPath?: boolean;
  /** Çok dilli senaryo adı (t('scenario_' + mission.scenarioId)) veya serbest için etiket */
  scenarioLabel?: string;
  /** Serbest kayda: prosedürel path noktaları (mission null iken kullanılır) */
  freeSkiPathPoints?: PathPoint[];
  /** Serbest kayda: toplam mesafe (m) – ilerleme çubuğu için */
  freeSkiTotalMeters?: number;
  /** Konum/arka plan override (örn. sağ orta, daha şeffaf) */
  containerStyle?: ViewStyle;
};

function MiniMap({
  mission,
  distanceTraveledMeters,
  isOffPath = false,
  scenarioLabel,
  freeSkiPathPoints,
  freeSkiTotalMeters,
  containerStyle,
}: Props): React.JSX.Element {
  const label = scenarioLabel ?? (mission?.scenarioId ?? '');
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
  const totalM = mission?.distanceMeters ?? freeSkiTotalMeters ?? 0;
  const progress = totalM <= 0 ? 0 : Math.min(1, distanceTraveledMeters / totalM);
  const points = (mission?.points?.length ? mission.points : freeSkiPathPoints) ?? [];
  if (points.length < 2) {
    return (
      <Animated.View
        style={[
          styles.container,
          isOffPath && { borderColor: 'rgba(220, 38, 38, 0.9)', borderWidth: 2 },
          isOffPath && { backgroundColor },
          containerStyle,
        ]}
      />
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
        containerStyle,
      ]}>
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
        <View style={styles.topNotch} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    top: 48,
    backgroundColor: 'transparent',
    padding: 0,
    zIndex: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
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
});

export default MiniMap;
