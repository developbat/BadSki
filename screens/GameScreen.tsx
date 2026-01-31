/**
 * Oyun ekranı - Hız fiziği (tab tab hızlanma), sınırsız sahne akışı, hız göstergesi
 */

import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Image,
  StyleSheet,
  StatusBar,
  Pressable,
  Text,
  Animated,
  Dimensions,
} from 'react-native';
import {SKYGUY_IMAGES, type SkierState} from '../constants/skyguy';
import GamePad from '../components/GamePad';
import {
  GOOD_ITEMS,
  BAD_ITEMS,
  OBSTACLE_DEFS,
  SPAWN_INTERVAL_PX,
  SPAWN_SCENE_CHANCE,
  SPAWN_CHANCE_OBSTACLE,
  SPAWN_CHANCE_GOOD,
  SPAWN_CHANCE_BAD,
  SUPER_SPEED_MULTIPLIER,
  SPEED_BOOST_ADD,
  type GoodItemId,
  type BadItemId,
  type ObstacleId,
} from '../constants/items';

const CLUMSY_DURATION_MS = 500;
const ACCELERATE_DURATION_MS = 400;
const SEGMENT_HEIGHT = 600;
const MAX_SPEED = 300;
const ACCELERATION_PER_TAP = 0.5;
const SCROLL_FACTOR = 0.08;
const TAP_RATE_WINDOW_MS = 1000;
const MAX_TAP_RATE = 10;
const DASH_WIDTH = 18;
const DASH_GAP = 14;
const WAVE_AMP = 4;
const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const DASHES_PER_ROW = Math.ceil(SCREEN_WIDTH / (DASH_WIDTH + DASH_GAP)) + 2;
const STAGE_TILT_PX = 28;
const TILT_RAMP_MS = 420;
const HORIZONTAL_DRIFT_SPEED = 4; // Her kare basılı tutulunca kayma (sınırsız)
const CENTER_RETURN_SPEED = 5; // Bırakınca ortaya animatik dönüş hızı (px/kare)
const SKIER_HIT_Y = SCREEN_HEIGHT - 220;
const SKIER_HIT_RANGE_Y = 55;
const SKIER_HIT_RANGE_X = 50;

type SpawnKind = 'obstacle' | 'good' | 'bad';
type Spawn = {
  id: string;
  kind: SpawnKind;
  itemId: ObstacleId | GoodItemId | BadItemId;
  worldY: number;
  worldX: number;
};

function pickByWeight<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[0];
}

function GameScreen(): React.JSX.Element {
  const [state, setState] = useState<SkierState>('stand');
  const [speed, setSpeed] = useState(0);
  const [tapRate, setTapRate] = useState(0);
  const hasCenterPressed = useRef(false);
  const speedRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const stageTranslateX = useRef(new Animated.Value(0)).current;
  const isDisabledRef = useRef(false);
  const tapTimestampsRef = useRef<number[]>([]);
  const [score, setScore] = useState(0);
  const [spawns, setSpawns] = useState<Spawn[]>([]);
  const spawnsRef = useRef<Spawn[]>([]);
  const spawnIdRef = useRef(0);
  const lastSpawnedScrollRef = useRef(0);
  const totalScrollRef = useRef(0);
  const stateRef = useRef(state);
  const ghostUntilRef = useRef(0);
  const superSpeedUntilRef = useRef(0);
  const badEffectUntilRef = useRef(0);
  const badSpeedMultiplierRef = useRef(1);
  const leftPressedAtRef = useRef(0);
  const rightPressedAtRef = useRef(0);
  const tiltAmountRef = useRef(0);
  const [leftTiltDisplay, setLeftTiltDisplay] = useState(0);
  const [rightTiltDisplay, setRightTiltDisplay] = useState(0);
  const leftTiltRef = useRef(0);
  const rightTiltRef = useRef(0);
  const slideStartTimeRef = useRef<number | null>(null);
  const [slideDurationSec, setSlideDurationSec] = useState(0);
  const lastScoreTickRef = useRef(0);
  const [lastCollectedItem, setLastCollectedItem] = useState<{ emoji: string } | null>(null);
  const skierOffsetXRef = useRef(0);
  const skierOffsetXAnim = useRef(new Animated.Value(0)).current;
  const worldPanXRef = useRef(0);
  const worldPanXAnim = useRef(new Animated.Value(0)).current;

  speedRef.current = speed;
  stateRef.current = state;
  isDisabledRef.current = state === 'clumsy' || state === 'fall-florr';
  spawnsRef.current = spawns;

  // Tab hızı göstergesi: son 1 saniyedeki basış sayısını güncelle
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      tapTimestampsRef.current = tapTimestampsRef.current.filter(
        t => now - t < TAP_RATE_WINDOW_MS,
      );
      setTapRate(tapTimestampsRef.current.length);
    }, 150);
    return () => clearInterval(id);
  }, []);

  // İlk açılış: stand → stand-ski
  useEffect(() => {
    const t = setTimeout(() => setState('stand-ski'), 800);
    return () => clearTimeout(t);
  }, []);

  // clumsy → fall-florr (düşme)
  useEffect(() => {
    if (state !== 'clumsy') return;
    const t = setTimeout(() => setState('fall-florr'), CLUMSY_DURATION_MS);
    return () => clearTimeout(t);
  }, [state]);

  // Hızlanma butonu: stand → stand-ski (düşme gibi arka arkaya)
  useEffect(() => {
    if (state !== 'stand' || !hasCenterPressed.current) return;
    hasCenterPressed.current = false;
    const t = setTimeout(() => setState('stand-ski'), ACCELERATE_DURATION_MS);
    return () => clearTimeout(t);
  }, [state]);

  // Tilt ibresi güncellemesi (GamePad için)
  useEffect(() => {
    const id = setInterval(() => {
      setLeftTiltDisplay(leftTiltRef.current);
      setRightTiltDisplay(rightTiltRef.current);
    }, 120);
    return () => clearInterval(id);
  }, []);

  // Kayma süresi göstergesi (her saniye)
  useEffect(() => {
    const id = setInterval(() => {
      if (slideStartTimeRef.current === null) return;
      const elapsed = Math.floor((Date.now() - slideStartTimeRef.current) / 1000);
      setSlideDurationSec(elapsed);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Sınırsız sahne akışı, tuzak spawn, tilt oranlı, çarpışma
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const now = Date.now();
      const scroll = scrollOffsetRef.current;
      const spd = speedRef.current;
      const disabled = isDisabledRef.current;
      const st = stateRef.current;
      let tiltPx = 0;
      if (st === 'left-ski' && leftPressedAtRef.current > 0) {
        const elapsed = now - leftPressedAtRef.current;
        tiltPx = Math.min(STAGE_TILT_PX, (elapsed / TILT_RAMP_MS) * STAGE_TILT_PX);
        leftTiltRef.current = tiltPx / STAGE_TILT_PX;
        rightTiltRef.current = 0;
      } else if (st === 'right-ski' && rightPressedAtRef.current > 0) {
        const elapsed = now - rightPressedAtRef.current;
        tiltPx = Math.min(STAGE_TILT_PX, (elapsed / TILT_RAMP_MS) * STAGE_TILT_PX);
        rightTiltRef.current = tiltPx / STAGE_TILT_PX;
        leftTiltRef.current = 0;
        tiltPx = -tiltPx;
      } else {
        leftTiltRef.current = 0;
        rightTiltRef.current = 0;
      }
      tiltAmountRef.current = tiltPx;
      stageTranslateX.setValue(tiltPx);

      // Basılı tutulunca sürekli yatay kayma; bırakınca ekran (kamera) kayakçıyı takip eder
      if (!disabled) {
        if (st === 'left-ski' && leftPressedAtRef.current > 0) {
          skierOffsetXRef.current -= HORIZONTAL_DRIFT_SPEED;
        } else if (st === 'right-ski' && rightPressedAtRef.current > 0) {
          skierOffsetXRef.current += HORIZONTAL_DRIFT_SPEED;
        } else {
          // Sol/sağ bırakıldı: dünya kayar, kayakçı ekranda ortaya gelir (ağaç sağındaysa sağında kalır)
          const cur = skierOffsetXRef.current;
          if (Math.abs(cur) > 0.5) {
            const step = Math.min(CENTER_RETURN_SPEED, Math.abs(cur));
            skierOffsetXRef.current = cur > 0 ? cur - step : cur + step;
            worldPanXRef.current += cur > 0 ? -step : step;
          } else if (Math.abs(worldPanXRef.current) > 0.5) {
            // Ortaya dönüş bitti: pan'ı dünya koordinatına yedir, birikmeyi önle
            const pan = worldPanXRef.current;
            worldPanXRef.current = 0;
            worldPanXAnim.setValue(0);
            const shifted = spawnsRef.current.map(s => ({ ...s, worldX: s.worldX + pan }));
            spawnsRef.current = shifted;
            setSpawns(shifted);
          }
        }
        skierOffsetXAnim.setValue(skierOffsetXRef.current);
        worldPanXAnim.setValue(worldPanXRef.current);
      }

      const superSpeed = now < superSpeedUntilRef.current;
      const badMult = badSpeedMultiplierRef.current;
      const effectiveSpeed =
        spd * (superSpeed ? SUPER_SPEED_MULTIPLIER : 1) * badMult;

      if (!disabled && effectiveSpeed > 0) {
        if (slideStartTimeRef.current === null) slideStartTimeRef.current = now;
        const delta = effectiveSpeed * SCROLL_FACTOR;
        scrollOffsetRef.current += delta;
        totalScrollRef.current += delta;
        // Hız ve süre ile orantılı ek puan (her ~200ms bir tick)
        if (now - lastScoreTickRef.current > 200) {
          lastScoreTickRef.current = now;
          setScore(prev => prev + Math.max(0, Math.floor(effectiveSpeed * 0.04)));
        }
        if (scrollOffsetRef.current >= SEGMENT_HEIGHT) {
          scrollOffsetRef.current -= SEGMENT_HEIGHT;
          // Scroll wrap: spawn'ların ekrandaki konumu korunsun (üzerinden geçebilsin)
          const shifted = spawnsRef.current.map(s => ({
            ...s,
            worldY: s.worldY + SEGMENT_HEIGHT,
          }));
          spawnsRef.current = shifted;
          setSpawns(shifted);
        }
        scrollAnim.setValue(scrollOffsetRef.current);
      }

      const scrollNow = scrollOffsetRef.current;
      const totalScroll = totalScrollRef.current;

      // Spawn: daha seyrek aralık + her sahnede şans faktörü (bazen hiç çıkmaz)
      if (
        !disabled &&
        spd > 0 &&
        totalScroll - lastSpawnedScrollRef.current > SPAWN_INTERVAL_PX
      ) {
        lastSpawnedScrollRef.current = totalScroll;
        if (Math.random() < SPAWN_SCENE_CHANCE) {
          // Objeler daha geriden çıksın: ekranın üstünden çok yukarıda spawn
          const worldY =
            scrollNow - SCREEN_HEIGHT - 320 + Math.random() * 200;
          const worldX =
            SCREEN_WIDTH * 0.2 + Math.random() * SCREEN_WIDTH * 0.6;
          const roll = Math.random() * 100;
          let kind: SpawnKind;
          let itemId: string;
          if (roll < SPAWN_CHANCE_OBSTACLE) {
            kind = 'obstacle';
            itemId = pickByWeight(OBSTACLE_DEFS).id;
          } else if (roll < SPAWN_CHANCE_OBSTACLE + SPAWN_CHANCE_GOOD) {
            kind = 'good';
            itemId = pickByWeight(GOOD_ITEMS).id;
          } else {
            kind = 'bad';
            itemId = pickByWeight(BAD_ITEMS).id;
          }
          const id = `spawn-${++spawnIdRef.current}`;
          const next = [
            ...spawnsRef.current,
            { id, kind, itemId: itemId as Spawn['itemId'], worldY, worldX },
          ];
          spawnsRef.current = next;
          setSpawns(next);
        }
      }

      // Sadece iyice ekranın altına çıkanları kaldır (üzerinden geçtikten sonra)
      const stillVisible = spawnsRef.current.filter(
        s => s.worldY + scrollNow < SCREEN_HEIGHT + 250,
      );
      if (stillVisible.length !== spawnsRef.current.length) {
        spawnsRef.current = stillVisible;
        setSpawns(stillVisible);
      }

      // Etki süreleri (bad effect: hız çarpanı)
      if (now > badEffectUntilRef.current) badSpeedMultiplierRef.current = 1;

      // Çarpışma / toplama (kayakçı merkez+kayma, item dünya+tilt+kamera pan)
      if (!disabled) {
        const ghost = now < ghostUntilRef.current;
        const skierX = SCREEN_WIDTH / 2 + skierOffsetXRef.current;
        for (const s of spawnsRef.current) {
          const screenY = s.worldY + scrollNow;
          const screenX = s.worldX + tiltAmountRef.current + worldPanXRef.current;
          const hit =
            Math.abs(screenY - SKIER_HIT_Y) < SKIER_HIT_RANGE_Y &&
            Math.abs(screenX - skierX) < SKIER_HIT_RANGE_X;
          if (!hit) continue;

          if (s.kind === 'obstacle') {
            if (!ghost) setState('clumsy');
            const next = spawnsRef.current.filter(x => x.id !== s.id);
            spawnsRef.current = next;
            setSpawns(next);
            break;
          }
          if (s.kind === 'good') {
            const def = GOOD_ITEMS.find(g => g.id === s.itemId);
            if (def) {
              if (def.points) setScore(prev => prev + def.points);
              if (def.effect === 'ghost') ghostUntilRef.current = now + def.durationMs;
              if (def.effect === 'super_speed') superSpeedUntilRef.current = now + def.durationMs;
              if (def.effect === 'speed_boost') setSpeed(prev => Math.min(MAX_SPEED, prev + SPEED_BOOST_ADD));
              setLastCollectedItem({ emoji: def.emoji });
            }
            const next = spawnsRef.current.filter(x => x.id !== s.id);
            spawnsRef.current = next;
            setSpawns(next);
            break;
          }
          if (s.kind === 'bad') {
            const def = BAD_ITEMS.find(b => b.id === s.itemId);
            if (def) {
              if (def.durationMs > 0) {
                badEffectUntilRef.current = now + def.durationMs;
                badSpeedMultiplierRef.current = def.speedMultiplier;
              } else {
                setSpeed(prev => Math.max(0, prev * def.speedMultiplier));
              }
              setLastCollectedItem({ emoji: def.emoji });
            }
            const next = spawnsRef.current.filter(x => x.id !== s.id);
            spawnsRef.current = next;
            setSpawns(next);
            break;
          }
        }
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [scrollAnim]);

  const handleFall = useCallback(() => setState('clumsy'), []);

  const handleCenterPress = useCallback(() => {
    hasCenterPressed.current = true;
    setState('stand');
    setSpeed(s => Math.min(MAX_SPEED, s + ACCELERATION_PER_TAP));
    tapTimestampsRef.current.push(Date.now());
  }, []);

  const handleRestart = useCallback(() => {
    setState('stand');
    setSpeed(0);
    setScore(0);
    setSpawns([]);
    spawnsRef.current = [];
    lastSpawnedScrollRef.current = 0;
    totalScrollRef.current = 0;
    ghostUntilRef.current = 0;
    superSpeedUntilRef.current = 0;
    badEffectUntilRef.current = 0;
    badSpeedMultiplierRef.current = 1;
    slideStartTimeRef.current = null;
    setSlideDurationSec(0);
    setLastCollectedItem(null);
    skierOffsetXRef.current = 0;
    skierOffsetXAnim.setValue(0);
    worldPanXRef.current = 0;
    worldPanXAnim.setValue(0);
  }, []);

  const isDisabled = state === 'clumsy' || state === 'fall-florr';

  const renderSegment = (keyPrefix: string) => (
    <View style={styles.segment}>
      {Array.from({length: 12}).map((_, rowIndex) =>
        Array.from({length: DASHES_PER_ROW}).map((_, dashIndex) => {
          const baseTop = (rowIndex * SEGMENT_HEIGHT) / 12;
          const wave = Math.sin(dashIndex * 0.45) * WAVE_AMP;
          return (
            <View
              key={`${keyPrefix}-${rowIndex}-${dashIndex}`}
              style={[
                styles.stripeDash,
                {
                  left: dashIndex * (DASH_WIDTH + DASH_GAP),
                  top: baseTop + wave,
                },
              ]}
            />
          );
        }),
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Sınırsız akan sahne - hıza oranlı */}
      <View style={styles.stageWrap} pointerEvents="none">
        <Animated.View
          style={[
            styles.stage,
            {
              transform: [
                {translateY: scrollAnim},
                {translateX: Animated.add(stageTranslateX, worldPanXAnim)},
              ],
            },
          ]}>
          {renderSegment('a')}
          <View style={styles.segmentCopy}>{renderSegment('b')}</View>
          {spawns.map(s => {
            if (s.kind === 'obstacle') {
              const isStone = s.itemId === 'stone';
              return (
                <View
                  key={s.id}
                  style={[
                    isStone ? styles.obstacleStone : styles.obstacleTree,
                    {
                      left: s.worldX - (isStone ? 14 : 42),
                      top: s.worldY - (isStone ? 14 : 84),
                    },
                  ]}>
                  {!isStone && (
                    <>
                      <View style={styles.treeTrunk} />
                      <View style={styles.treeTop} />
                    </>
                  )}
                </View>
              );
            }
            const emoji =
              s.kind === 'good'
                ? GOOD_ITEMS.find(g => g.id === s.itemId)?.emoji ?? '❓'
                : BAD_ITEMS.find(b => b.id === s.itemId)?.emoji ?? '❓';
            return (
              <View
                key={s.id}
                style={[styles.emojiItem, { left: s.worldX - 18, top: s.worldY - 18 }]}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </View>
            );
          })}
        </Animated.View>
      </View>

      {/* Sol orta: kompakt panel – hız, yıldız+puan, saat+süre, boş yuvarlak+item */}
      <View style={styles.leftPanel}>
        <View style={styles.leftPanelRow}>
          <Text style={styles.leftPanelIcon}>⚡</Text>
          <Text style={styles.leftPanelValue}>{speed.toFixed(0)}</Text>
        </View>
        <View style={styles.leftPanelRow}>
          <Text style={styles.leftPanelIcon}>⭐</Text>
          <Text style={styles.leftPanelValue}>{score}</Text>
        </View>
        <View style={styles.leftPanelRow}>
          <Text style={styles.leftPanelIcon}>🕐</Text>
          <Text style={styles.leftPanelValue}>
            {Math.floor(slideDurationSec / 60)}:{(slideDurationSec % 60).toString().padStart(2, '0')}
          </Text>
        </View>
        <View style={styles.leftPanelRow}>
          <View style={styles.lastItemCircle}>
            {lastCollectedItem ? (
              <Text style={styles.lastItemEmoji}>{lastCollectedItem.emoji}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Sağa yaslı, minimal boşluk: hız tüpü */}
      <View style={styles.speedTubeWrap}>
        <View style={styles.speedTubeOuter}>
          <View style={styles.speedTubeZones}>
            <View style={[styles.speedTubeZone, styles.speedBarGreen]} />
            <View style={[styles.speedTubeZone, styles.speedBarYellow]} />
            <View style={[styles.speedTubeZone, styles.speedBarRed]} />
          </View>
          <View
            style={[
              styles.speedTubeFill,
              {
                height: `${Math.min(100, (tapRate / MAX_TAP_RATE) * 100)}%`,
                backgroundColor:
                  tapRate >= 7
                    ? 'rgba(239, 68, 68, 0.8)'
                    : tapRate >= 4
                      ? 'rgba(234, 179, 8, 0.8)'
                      : 'rgba(34, 197, 94, 0.8)',
              },
            ]}
          />
        </View>
        <Text style={styles.speedTubeValue}>{speed.toFixed(0)}</Text>
      </View>

      {/* Sağ üst: Reset */}
      <View style={styles.topRight}>
        {state === 'fall-florr' ? (
          <Pressable style={styles.resetButton} onPress={handleRestart}>
            <Text style={styles.buttonLabel}>Reset</Text>
          </Pressable>
        ) : state === 'clumsy' ? (
          <View style={styles.resetButtonDisabled}>
            <Text style={styles.buttonLabel}>...</Text>
          </View>
        ) : (
          <Pressable style={styles.resetButton} onPress={handleFall}>
            <Text style={styles.buttonLabel}>Reset</Text>
          </Pressable>
        )}
      </View>

      {/* Kayakçı – yatay kayma ile sınırsız sola/sağa */}
      <View style={styles.skierWrap}>
        <Animated.View
          style={[
            styles.skierFrame,
            { transform: [{ translateX: skierOffsetXAnim }] },
          ]}>
          <Image
            source={SKYGUY_IMAGES[state]}
            style={state === 'right-ski' ? styles.skierSmall : styles.skier}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <GamePad
        onLeft={() => {
          leftPressedAtRef.current = Date.now();
          setState('left-ski');
        }}
        onLeftRelease={() => {
          leftPressedAtRef.current = 0;
          setState('stand-ski');
        }}
        onCenter={handleCenterPress}
        onCenterRelease={() => {}}
        onRight={() => {
          rightPressedAtRef.current = Date.now();
          setState('right-ski');
        }}
        onRightRelease={() => {
          rightPressedAtRef.current = 0;
          setState('stand-ski');
        }}
        leftTilt={leftTiltDisplay}
        rightTilt={rightTiltDisplay}
        disabled={isDisabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  stageWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  stage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: SEGMENT_HEIGHT * 2,
  },
  segment: {
    height: SEGMENT_HEIGHT,
    backgroundColor: '#ffffff',
  },
  segmentCopy: {
    height: SEGMENT_HEIGHT,
  },
  stripeDash: {
    position: 'absolute',
    width: DASH_WIDTH,
    height: 1,
    backgroundColor: 'rgba(120, 120, 120, 0.12)',
  },
  obstacleStone: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 12,
    backgroundColor: 'rgba(100, 100, 100, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(80, 80, 80, 0.9)',
    transform: [{ skewX: '4deg' }, { skewY: '-3deg' }],
  },
  obstacleTree: {
    position: 'absolute',
    width: 84,
    height: 168,
    alignItems: 'center',
  },
  treeTrunk: {
    position: 'absolute',
    bottom: 0,
    width: 30,
    height: 66,
    backgroundColor: 'rgba(101, 67, 33, 0.9)',
    borderRadius: 6,
  },
  treeTop: {
    position: 'absolute',
    top: 0,
    width: 78,
    height: 108,
    backgroundColor: 'rgba(34, 139, 34, 0.85)',
    borderRadius: 39,
  },
  leftPanel: {
    position: 'absolute',
    left: 8,
    top: SCREEN_HEIGHT / 2 - 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 72,
    backgroundColor: 'rgba(59, 130, 246, 0.60)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    zIndex: 20,
  },
  leftPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
    gap: 4,
  },
  leftPanelIcon: {
    fontSize: 14,
  },
  leftPanelValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  lastItemCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastItemEmoji: {
    fontSize: 16,
  },
  speedTubeWrap: {
    position: 'absolute',
    right: 6,
    top: SCREEN_HEIGHT * 0.42,
    width: 32,
    alignItems: 'center',
    zIndex: 20,
  },
  speedTubeOuter: {
    width: 28,
    height: 160,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(15, 23, 42, 0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    overflow: 'hidden',
  },
  speedTubeZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column-reverse',
  },
  speedTubeZone: {
    flex: 1,
    minHeight: 160 / 3,
  },
  speedBarRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  speedBarYellow: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
  },
  speedBarGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  speedTubeFill: {
    position: 'absolute',
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 10,
  },
  speedTubeValue: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(34, 197, 94, 0.95)',
  },
  topRight: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 20,
    alignItems: 'flex-end',
  },
  resetButton: {
    backgroundColor: '#64748b',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  resetButtonDisabled: {
    backgroundColor: '#94a3b8',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  emojiItem: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(200,200,200,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  skierWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 180,
    zIndex: 5,
  },
  skierFrame: {
    width: 120,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skier: {
    width: 120,
    height: 160,
  },
  skierSmall: {
    width: 80,
    height: 120,
  },
});

export default GameScreen;
