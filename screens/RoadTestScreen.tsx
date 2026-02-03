/**
 * Road test – oyun gibi: karakter 5 km/h ile başlar, sen hızlandırırsın.
 * Sahne kendi ilerlemez; sen ilerledikçe hızın kadar sahne gelir. Sağ/sol efektler düzeltildi.
 */

import React, { useLayoutEffect, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Pressable,
  Text,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import GamePad from '../components/GamePad';
import MiniMap from '../components/MiniMap';
import { getPathCurveAt, getPathCenterXPx, SCENARIO_THEMES, SCROLL_TO_METERS, type Mission, type PathPoint } from '../constants/missions';
import {
  LAYOUT_WIDTH_PX,
  ROAD_LEFT_PX,
  ROAD_RIGHT_PX,
  ROAD_CENTER_PX,
  ROAD_HALF_WIDTH_PX,
} from '../constants/roadLayout';
import { buildSpawnPlanForRun, type SpawnPlanEntry } from '../constants/spawnPlan';
import { getProceduralPathCenterWorldX } from '../constants/trackPath';
import { OBSTACLE_IMAGES } from '../constants/obstacles';
import { getObstacleById } from '../constants/obstacles';
import { GOOD_ITEMS, BAD_ITEMS, SPEED_BOOST_ADD, getGoodItemDescription, getBadItemDescription, type GoodItemId, type BadItemId } from '../constants/items';
import { ROCKET_DURATION_MS } from '../constants/upgrades';
import { useI18n } from '../i18n';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FLAT_IMAGE = require('../assets/road/flat.jpg');
/** Normal duruş (hız tuşuna basılmıyor). */
const STAND_IMAGE = require('../assets/skyguy/stand.png');
/** Hızlanma pozu – hız tuşuna basıldığında stand-ski görünür. */
const STAND_SKI_IMAGE = require('../assets/skyguy/stand-ski.png');
const LEFT_SKI_IMAGE = require('../assets/skyguy/left-ski.png');
const RIGHT_SKI_IMAGE = require('../assets/skyguy/right-ski.png');
const JUMP_IMAGE = require('../assets/skyguy/jump.png');
const CLUMSY_IMAGE = require('../assets/skyguy/clumsy.png');
const FALL_IMAGE = require('../assets/skyguy/fall-florr.png');

/** Yol görseli yüksekliği (px). roadLayout'taki genişlik LAYOUT_WIDTH_PX. */
const ROAD_IMAGE_HEIGHT = 1200;
const TILE_HEIGHT = ROAD_IMAGE_HEIGHT;
const ABOVE_TILES = 5;
const NUM_TILES = 12;
const INITIAL_OFFSET_PX = ABOVE_TILES * TILE_HEIGHT;
const MOVE_SPEED_PX_PER_MS = 0.45;

/** Oynanabilir yol: merkezden yanlara bu kadar dışarı genişletilir (her iki taraf, px). */
const BOUNDARY_EXTRA_PX = 100;
const MAX_OFFSET_PX = ROAD_HALF_WIDTH_PX + BOUNDARY_EXTRA_PX;
/** Kamera sağ/sol kaymada hedefi ne kadar hızlı takip eder (yüksek = akıcı). */
const CAMERA_EASE = 0.22;
const BOUNDARY_SPEED_FACTOR = 0.4;
/** Sınırda sürtünme: bu oranın üstündeyken hız yavaşlar; gazla tekrar hızlanabilir. */
const BOUNDARY_RUB_THRESHOLD = 0.72;
/** Sınırda sürtünürken hız bu değerin altına inmez – frenleyerek durma değil, sürtünerek yavaş sürme hissi. */
const BOUNDARY_MIN_SPEED_KMH = 18;
/** Sınırda sürtünme: km/h per ms. Yüksek hızda hızlı yavaşlar, bu min hızda durur (tam durma yok). */
const BOUNDARY_FRICTION_PER_MS = 0.024;
/** Sınırda clumsy tetiklenince tekrar tetikleme için bekleme (ms). */
const BOUNDARY_CLUMSY_COOLDOWN_MS = 1600;
/** Sınırda tökezleyince merkeze minimal itme (px) – sadece takılmasın. */
const BOUNDARY_NUDGE_PX = 10;

const TILT_RAMP_MS = 260;
const ACCEL_RAMP_MS = 260;
const ACCEL_ADD_INTERVAL_MS = 120;
const JUMP_DURATION_MS = 600;
const CLUMSY_DURATION_MS = 400;
/** Zıpla tuşuna çift basımda roket tetiklenir; bu süre (ms) içinde ikinci basım sayılır. */
const JUMP_DOUBLE_TAP_MS = 400;

const MIN_SPEED_KMH = 5;
const MAX_SPEED_KMH = 80;
const SPEED_RANGE = MAX_SPEED_KMH - MIN_SPEED_KMH;
const SCROLL_FACTOR = 0.18;

const TOTAL_SCROLL_REF_INIT = 0;
const CURVE_AMPLITUDE = 0.35;
const CURVE_FREQUENCY = 0.0005;
const DRIFT_STRENGTH = 0.7;
/** Karakter eğimi (virajda yatma). */
const CURVE_TILT_DEG = 12;
/** Kamera dönüşü (virajda sahne rotasyonu). */
const CURVE_CAMERA_DEG = 4.5;
/** Keskin virajlarda ek dönme: curve³ ile güçlü etki. */
const CURVE_CAMERA_SHARP_BOOST = 2.8;

type SkierState = 'stand-ski' | 'left-ski' | 'right-ski' | 'jump' | 'clumsy' | 'fall-florr';

export type RoadTestMode = 'standalone' | 'rolling' | 'preview' | 'game';

type Props = {
  onBack?: () => void;
  /** Harita virajını simüle etmek için path noktaları (preview/rolling). Yoksa prosedürel viraj. */
  pathPoints?: PathPoint[] | null;
  /** Preview modunda gösterilecek görev (isim, km) */
  mission?: Mission | null;
  /** Görev önizlemede "Başla" tıklanınca */
  onStart?: () => void;
  /** Görev önizlemede "Farklı görev" tıklanınca */
  onDifferent?: () => void;
  mode?: RoadTestMode;
  /** Oyun modunda spawn şansları için (buildSpawnPlanForRun) */
  level?: number;
  goodSpawnLevel?: number;
  badSpawnLevel?: number;
  reduceGhostRocket?: boolean;
  /** Oyun bitince / geri tıklanınca (skor, mesafe m) */
  onExit?: (score: number, distanceMeters?: number) => void;
  /** Koşu bitince (skor) – yeniden başlamadan önce */
  onRunEnd?: (score: number) => void;
  /** Başlangıç roket sayısı (yükseltmeden satın alınan) */
  initialRocketCount?: number;
  /** Başlangıç ekstra can sayısı (yükseltmeden satın alınan) */
  initialExtraLivesCount?: number;
  /** Düşünce "Devam et" (reklam) – reklam izlendikten sonra devam edilir */
  onContinueWithAd?: () => void | Promise<void>;
};

const METERS_TO_STRIP_PX = 40;
const SKIER_SCREEN_Y = SCREEN_HEIGHT - 220;
const SPAWN_VIEW_AHEAD_M = 55;
const SPAWN_VIEW_BEHIND_M = 15;
const SPAWN_UPDATE_INTERVAL_MS = 80;
const MAX_VISIBLE_SPAWNS = 24;
const SKIER_HIT_HALF_X = 32;
const SKIER_HIT_TOP_OFFSET = 60;
const SKIER_HIT_BOTTOM_OFFSET = 20;

function RoadTestScreen({ onBack, pathPoints, mission, onStart, onDifferent, mode = 'standalone', level = 1, goodSpawnLevel = 0, badSpawnLevel = 0, reduceGhostRocket = false, onExit, onRunEnd, initialRocketCount = 0, initialExtraLivesCount = 0, onContinueWithAd }: Props): React.JSX.Element {
  const { t } = useI18n();
  const translateY = useRef(new Animated.Value(-INITIAL_OFFSET_PX)).current;
  const [tiles, setTiles] = useState(() => Array(NUM_TILES).fill(FLAT_IMAGE));
  const totalHeight = NUM_TILES * TILE_HEIGHT;

  const [speed, setSpeed] = useState(MIN_SPEED_KMH);
  const speedRef = useRef(MIN_SPEED_KMH);
  const scrollOffsetRef = useRef(0);
  const totalScrollRef = useRef(TOTAL_SCROLL_REF_INIT);
  const lastAccelAddRef = useRef(0);

  const skierOffsetXRef = useRef(0);
  const skierOffsetXAnim = useRef(new Animated.Value(0)).current;
  const panXRef = useRef(0);
  const panXAnim = useRef(new Animated.Value(0)).current;
  const charXAnim = useRef(new Animated.Value(0)).current;
  const curveTiltAnim = useRef(new Animated.Value(0)).current;
  const curveCameraAnim = useRef(new Animated.Value(0)).current;
  const leftPressedAtRef = useRef(0);
  const rightPressedAtRef = useRef(0);
  const leftTiltRef = useRef(0);
  const rightTiltRef = useRef(0);
  const [leftTiltDisplay, setLeftTiltDisplay] = useState(0);
  const [rightTiltDisplay, setRightTiltDisplay] = useState(0);

  const accelPressedAtRef = useRef(0);
  const [accelHold, setAccelHold] = useState(0);

  const [state, setState] = useState<SkierState>('stand-ski');
  const jumpEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clumsyEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Path tabanlı viraj için: kat edilen mesafe (m). pathPoints varken her frame güncellenir. */
  const distanceMetersRef = useRef(0);
  const [distanceTraveledMeters, setDistanceTraveledMeters] = useState(0);
  const [skierOffsetX, setSkierOffsetX] = useState(0);
  const [panX, setPanX] = useState(0);

  /** Spawn planı (oyun modunda, harita oluşturulunca bir kez set edilir). */
  const spawnPlanRef = useRef<(SpawnPlanEntry & { id: string })[]>([]);
  const collectedSpawnIdsRef = useRef<Set<string>>(new Set());
  const [collectedCount, setCollectedCount] = useState(0);

  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [gameWon, setGameWon] = useState(false);
  const gameWonRef = useRef(false);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);
  const [completionBonus, setCompletionBonus] = useState(0);
  const ghostUntilRef = useRef(0);
  const speedBoostUntilRef = useRef(0);
  const speedBoostAmountRef = useRef(0);
  const badEffectUntilRef = useRef(0);
  const badSpeedMultiplierRef = useRef(1);
  const [rocketCount, setRocketCount] = useState(0);
  const [extraLivesCount, setExtraLivesCount] = useState(0);
  const extraLivesCountRef = useRef(0);
  const lastBoundaryClumsyAtRef = useRef(0);
  const lastJumpPressRef = useRef(0);
  const [lastCollectedItem, setLastCollectedItem] = useState<{ emoji: string; description: string; kind: 'good' | 'bad' | 'obstacle' | 'boundary' } | null>(null);
  const [restartCount, setRestartCount] = useState(0);

  speedRef.current = speed;
  scoreRef.current = score;
  gameWonRef.current = gameWon;
  gameOverRef.current = gameOver;
  extraLivesCountRef.current = extraLivesCount;

  useLayoutEffect(() => {
    if (pathPoints?.length) distanceMetersRef.current = 0;
  }, [pathPoints]);

  useLayoutEffect(() => {
    if (mode !== 'game') return;
    collectedSpawnIdsRef.current = new Set();
    setScore(0);
    setGameWon(false);
    setGameOver(false);
    setCompletionBonus(0);
    setRocketCount(initialRocketCount);
    setExtraLivesCount(initialExtraLivesCount);
    setLastCollectedItem(null);
    setState('stand-ski');
    setSpeed(MIN_SPEED_KMH);
    ghostUntilRef.current = 0;
    speedBoostUntilRef.current = 0;
    speedBoostAmountRef.current = 0;
    badEffectUntilRef.current = 0;
    badSpeedMultiplierRef.current = 1;
    lastJumpPressRef.current = 0;
    const plan = buildSpawnPlanForRun({
      mission: mission ?? null,
      level,
      goodSpawnLevel,
      badSpawnLevel,
      screenWidth: SCREEN_WIDTH,
      reduceGhostRocket,
    });
    spawnPlanRef.current = plan.map((e, i) => ({ ...e, id: `spawn-${e.scrollPx}-${e.kind}-${i}` }));
  }, [mode, mission, level, goodSpawnLevel, badSpawnLevel, reduceGhostRocket, initialRocketCount, initialExtraLivesCount, restartCount]);

  useLayoutEffect(() => {
    if (mode !== 'game' || restartCount === 0) return;
    translateY.setValue(-INITIAL_OFFSET_PX);
    scrollOffsetRef.current = 0;
    totalScrollRef.current = TOTAL_SCROLL_REF_INIT;
    distanceMetersRef.current = 0;
    const startPan = Math.max(0, Math.min(LAYOUT_WIDTH_PX - SCREEN_WIDTH, ROAD_CENTER_PX - SCREEN_WIDTH / 2));
    panXRef.current = startPan;
    panXAnim.setValue(-startPan);
    charXAnim.setValue(0);
    skierOffsetXRef.current = 0;
    skierOffsetXAnim.setValue(0);
  }, [mode, restartCount, translateY, panXAnim, charXAnim, skierOffsetXAnim]);

  useLayoutEffect(() => {
    translateY.setValue(-INITIAL_OFFSET_PX);
    scrollOffsetRef.current = 0;
    const startPan = Math.max(0, Math.min(LAYOUT_WIDTH_PX - SCREEN_WIDTH, ROAD_CENTER_PX - SCREEN_WIDTH / 2));
    panXRef.current = startPan;
    panXAnim.setValue(-startPan);
    charXAnim.setValue(0);
  }, [translateY, panXAnim, charXAnim]);

  useEffect(() => {
    let lastT = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(now - lastT, 50);
      lastT = now;
      if (speedBoostUntilRef.current > 0 && now > speedBoostUntilRef.current) {
        const amt = speedBoostAmountRef.current;
        speedBoostUntilRef.current = 0;
        speedBoostAmountRef.current = 0;
        if (amt > 0) setSpeed((s) => Math.max(MIN_SPEED_KMH, s - amt));
      }
      if (badEffectUntilRef.current > 0 && now > badEffectUntilRef.current) {
        badEffectUntilRef.current = 0;
        badSpeedMultiplierRef.current = 1;
      }
      /* —— Sağa/sola kayma: sol/sağ basılı → skierOffsetX güncellenir (maxOffsetAtSpeed sınırı).
       * Viraj: curve (path veya sin) → drift ile skierOffsetX’e ek itme. Kamera: targetPanX = merkez + offset,
       * panXRef CAMERA_EASE ile hedefe yaklaşır. İlerleme: effectiveSpeed sadece sınırda (boundaryRatio >= threshold)
       * düşer; orta bölgede tam hız, takılma hissi yok. */
      const leftHeld = leftPressedAtRef.current > 0;
      const rightHeld = rightPressedAtRef.current > 0;
      const canMove = state === 'stand-ski' || state === 'left-ski' || state === 'right-ski';
      const worldPaused = state === 'clumsy' || state === 'fall-florr';

      if (canMove) {
        const spd = speedRef.current;
        const speedFactor = Math.max(0, Math.min(1, (spd - MIN_SPEED_KMH) / SPEED_RANGE));
        const maxOffsetAtSpeed = MAX_OFFSET_PX * (1 - 0.55 * speedFactor);
        const moveSpeedAtSpeed = MOVE_SPEED_PX_PER_MS * (1 - 0.6 * speedFactor);
        if (leftHeld) {
          const elapsed = now - leftPressedAtRef.current;
          leftTiltRef.current = Math.min(1, elapsed / TILT_RAMP_MS);
          rightTiltRef.current = 0;
          skierOffsetXRef.current = Math.max(-maxOffsetAtSpeed, skierOffsetXRef.current - moveSpeedAtSpeed * dt);
        } else if (rightHeld) {
          const elapsed = now - rightPressedAtRef.current;
          rightTiltRef.current = Math.min(1, elapsed / TILT_RAMP_MS);
          leftTiltRef.current = 0;
          skierOffsetXRef.current = Math.min(maxOffsetAtSpeed, skierOffsetXRef.current + moveSpeedAtSpeed * dt);
        } else {
          leftTiltRef.current = 0;
          rightTiltRef.current = 0;
        }
      }
      const curve = pathPoints?.length
        ? getPathCurveAt(distanceMetersRef.current, pathPoints)
        : CURVE_AMPLITUDE * Math.sin(totalScrollRef.current * CURVE_FREQUENCY);
      if (canMove && !worldPaused && speedRef.current > 0) {
        const drift = -curve * DRIFT_STRENGTH * (dt / 16) * (0.5 + speedRef.current / 160);
        skierOffsetXRef.current += drift;
      }
      const spd = speedRef.current;
      const speedFactor = Math.max(0, Math.min(1, (spd - MIN_SPEED_KMH) / SPEED_RANGE));
      const maxOffsetAtSpeed = MAX_OFFSET_PX * (1 - 0.55 * speedFactor);
      skierOffsetXRef.current = Math.max(-maxOffsetAtSpeed, Math.min(maxOffsetAtSpeed, skierOffsetXRef.current));
      skierOffsetXAnim.setValue(skierOffsetXRef.current);

      curveTiltAnim.setValue(curve * CURVE_TILT_DEG);
      const cameraAngle = curve * CURVE_CAMERA_DEG + curve * curve * curve * CURVE_CAMERA_SHARP_BOOST;
      curveCameraAnim.setValue(cameraAngle);

      if (mode === 'game' && spawnPlanRef.current.length > 0 && !worldPaused) {
        const currentDist = distanceMetersRef.current;
        const skierX = SCREEN_WIDTH / 2;
        const skierTop = SKIER_SCREEN_Y - SKIER_HIT_TOP_OFFSET;
        const skierBottom = SKIER_SCREEN_Y + SKIER_HIT_BOTTOM_OFFSET;
        const offsetX = skierOffsetXRef.current;
        for (const entry of spawnPlanRef.current) {
          if (collectedSpawnIdsRef.current.has(entry.id)) continue;
          const entryDist = entry.scrollPx * SCROLL_TO_METERS;
          if (entryDist < currentDist - SPAWN_VIEW_BEHIND_M || entryDist > currentDist + SPAWN_VIEW_AHEAD_M) continue;
          const pathCenterAtSpawn =
            pathPoints?.length
              ? getPathCenterXPx(entryDist, pathPoints)
              : getProceduralPathCenterWorldX(entry.scrollPx, SCREEN_WIDTH) - SCREEN_WIDTH / 2;
          const spawnX = entry.worldX - pathCenterAtSpawn - offsetX;
          const spawnY = SKIER_SCREEN_Y - (entryDist - currentDist) * METERS_TO_STRIP_PX;
          const overlapX = Math.abs(spawnX - skierX) < SKIER_HIT_HALF_X;
          const overlapY = spawnY >= skierTop && spawnY <= skierBottom;
          if (!overlapX || !overlapY) continue;
          if (entry.kind === 'obstacle') {
            if (now < ghostUntilRef.current) continue;
            collectedSpawnIdsRef.current.add(entry.id);
            setCollectedCount((c) => c + 1);
            const obs = getObstacleById(entry.itemId as string);
            const desc = obs?.description ?? '💥';
            const emoji = desc.includes(' = ') ? desc.split(' = ')[0]?.trim() ?? '💥' : '💥';
            setLastCollectedItem({ emoji, description: desc, kind: 'obstacle' });
            if (extraLivesCountRef.current > 0) {
              setExtraLivesCount((c) => c - 1);
              setState('clumsy');
              if (clumsyEndRef.current) clearTimeout(clumsyEndRef.current);
              clumsyEndRef.current = setTimeout(() => {
                clumsyEndRef.current = null;
                setState('stand-ski');
              }, CLUMSY_DURATION_MS);
            } else {
              setGameOver(true);
              setState('clumsy');
              if (clumsyEndRef.current) clearTimeout(clumsyEndRef.current);
              clumsyEndRef.current = setTimeout(() => {
                clumsyEndRef.current = null;
                setState('fall-florr');
              }, CLUMSY_DURATION_MS);
            }
          } else if (entry.kind === 'good') {
            collectedSpawnIdsRef.current.add(entry.id);
            setCollectedCount((c) => c + 1);
            const def = GOOD_ITEMS.find((g) => g.id === entry.itemId);
            if (def) {
              setLastCollectedItem({ emoji: def.emoji, description: getGoodItemDescription(entry.itemId as string) ?? def.description, kind: 'good' });
              if (def.points) setScore((prev) => prev + def.points);
              if (def.effect === 'ghost') ghostUntilRef.current = now + def.durationMs;
              else if (def.effect === 'speed_boost') {
                const add = SPEED_BOOST_ADD;
                setSpeed((s) => s + add);
                speedBoostAmountRef.current += add;
                speedBoostUntilRef.current = now + def.durationMs;
              } else if (def.effect === 'inventory_rocket') setRocketCount((c) => c + 1);
              else if (def.effect === 'inventory_shield') setExtraLivesCount((c) => c + 1);
            }
          } else if (entry.kind === 'bad') {
            collectedSpawnIdsRef.current.add(entry.id);
            setCollectedCount((c) => c + 1);
            const bad = BAD_ITEMS.find((i) => i.id === entry.itemId);
            if (bad) {
              setLastCollectedItem({ emoji: bad.emoji, description: getBadItemDescription(entry.itemId as string) ?? bad.description, kind: 'bad' });
              if (bad.durationMs > 0) {
                badEffectUntilRef.current = now + bad.durationMs;
                badSpeedMultiplierRef.current = bad.speedMultiplier;
              } else {
                setSpeed((s) => Math.max(MIN_SPEED_KMH, s * bad.speedMultiplier));
              }
              const penalty = bad.scorePenalty;
              if (penalty != null) setScore((prev) => Math.max(0, prev + penalty));
            }
          }
        }
      }

      const targetPanX = ROAD_CENTER_PX + skierOffsetXRef.current - SCREEN_WIDTH / 2;
      const minPan = 0;
      const maxPan = Math.max(0, LAYOUT_WIDTH_PX - SCREEN_WIDTH);
      const clampedPan = Math.max(minPan, Math.min(maxPan, targetPanX));
      panXRef.current += (clampedPan - panXRef.current) * CAMERA_EASE;
      panXAnim.setValue(-panXRef.current);
      charXAnim.setValue(-panXRef.current + skierOffsetXRef.current + ROAD_CENTER_PX - SCREEN_WIDTH / 2);

      if (!worldPaused && speedRef.current > 0 && !gameOverRef.current) {
        const boundaryRatio = maxOffsetAtSpeed > 0 ? Math.abs(skierOffsetXRef.current) / maxOffsetAtSpeed : 0;
        /* Sınır sürtünmesi: özellik (ghost vb.) olsa bile her zaman hız düşer. */
        if (boundaryRatio >= BOUNDARY_RUB_THRESHOLD) {
          const decay = BOUNDARY_FRICTION_PER_MS * dt;
          setSpeed((s) => Math.max(BOUNDARY_MIN_SPEED_KMH, s - decay));
          if (canMove && now - lastBoundaryClumsyAtRef.current >= BOUNDARY_CLUMSY_COOLDOWN_MS) {
            lastBoundaryClumsyAtRef.current = now;
            if (skierOffsetXRef.current < 0) {
              skierOffsetXRef.current = Math.min(0, skierOffsetXRef.current + BOUNDARY_NUDGE_PX);
            } else {
              skierOffsetXRef.current = Math.max(0, skierOffsetXRef.current - BOUNDARY_NUDGE_PX);
            }
            skierOffsetXAnim.setValue(skierOffsetXRef.current);
            setLastCollectedItem({ emoji: '⚠️', description: t('game_boundaryHit'), kind: 'boundary' });
            setState('clumsy');
            if (clumsyEndRef.current) clearTimeout(clumsyEndRef.current);
            clumsyEndRef.current = setTimeout(() => {
              clumsyEndRef.current = null;
              setState('stand-ski');
            }, CLUMSY_DURATION_MS);
          }
        }
        /* Sınırda yavaşlama: sadece gerçekten sınıra sürterken (boundaryRatio >= threshold) ilerleme düşer;
         * orta/sol/sağ kaymada speedMult = 1 kalır, böylece takılma/durma hissi olmaz. */
        const speedMult =
          boundaryRatio >= BOUNDARY_RUB_THRESHOLD
            ? 1 - boundaryRatio * BOUNDARY_SPEED_FACTOR
            : 1;
        const badMult = badSpeedMultiplierRef.current;
        const effectiveSpeed = Math.max(MIN_SPEED_KMH * 0.3, speedRef.current * speedMult * badMult);
        const delta = effectiveSpeed * SCROLL_FACTOR * (dt / 16);
        scrollOffsetRef.current += delta;
        totalScrollRef.current += delta;
        distanceMetersRef.current += (effectiveSpeed * dt) / 3600;
        if (mode === 'game' && mission && !gameWonRef.current && distanceMetersRef.current >= mission.distanceMeters) {
          gameWonRef.current = true;
          setGameWon(true);
          const distanceBonus = Math.round((mission.distanceMeters / 1000) * 50);
          const theme = SCENARIO_THEMES.find((th) => th.id === mission.scenarioId);
          const difficultyBonus = theme ? Math.round(theme.curveIntensity * 100) : 0;
          const totalBonus = distanceBonus + difficultyBonus;
          setCompletionBonus(totalBonus);
          setScore((prev) => prev + totalBonus);
        }
        const n = Math.floor(scrollOffsetRef.current / TILE_HEIGHT);
        if (n > 0) {
          scrollOffsetRef.current -= n * TILE_HEIGHT;
          setTiles((prev) => [...Array(n).fill(FLAT_IMAGE), ...prev.slice(0, -n)]);
        }
        translateY.setValue(-INITIAL_OFFSET_PX + scrollOffsetRef.current);
      }
    };
    const id = setInterval(tick, 16);
    return () => clearInterval(id);
  }, [state]);

  const handleJumpPress = useCallback(() => {
    if (state !== 'stand-ski' && state !== 'left-ski' && state !== 'right-ski') return;
    const now = Date.now();
    if (lastJumpPressRef.current > 0 && now - lastJumpPressRef.current < JUMP_DOUBLE_TAP_MS && rocketCount > 0) {
      lastJumpPressRef.current = 0;
      setRocketCount((c) => c - 1);
      const add = SPEED_BOOST_ADD;
      setSpeed((s) => Math.min(MAX_SPEED_KMH, s + add));
      speedBoostAmountRef.current += add;
      speedBoostUntilRef.current = now + ROCKET_DURATION_MS;
      return;
    }
    lastJumpPressRef.current = now;
    if (jumpEndRef.current) clearTimeout(jumpEndRef.current);
    setState('jump');
    jumpEndRef.current = setTimeout(() => {
      jumpEndRef.current = null;
      setState('stand-ski');
    }, JUMP_DURATION_MS);
  }, [state, rocketCount]);

  const handleJumpRelease = useCallback(() => {}, []);

  const handleAccelRelease = useCallback(() => {
    accelPressedAtRef.current = 0;
    setAccelHold(0);
    /* Gazı bırakınca sadece hız düşer; düşme/clumsy tetiklenmez. */
  }, []);

  useEffect(() => {
    return () => {
      if (jumpEndRef.current) clearTimeout(jumpEndRef.current);
      if (clumsyEndRef.current) clearTimeout(clumsyEndRef.current);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const speedFactor = Math.max(0, Math.min(1, (speedRef.current - MIN_SPEED_KMH) / SPEED_RANGE));
      const tiltScale = 1 - 0.5 * speedFactor;
      setLeftTiltDisplay(leftTiltRef.current * tiltScale);
      setRightTiltDisplay(rightTiltRef.current * tiltScale);
      setDistanceTraveledMeters(distanceMetersRef.current);
      setSkierOffsetX(skierOffsetXRef.current);
      setPanX(panXRef.current);
    }, SPAWN_UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const at = accelPressedAtRef.current;
      const now = Date.now();
      if (at === 0) {
        setAccelHold(0);
        return;
      }
      const elapsed = now - at;
      const hold = Math.min(1, elapsed / ACCEL_RAMP_MS);
      setAccelHold(hold);
      if (now - lastAccelAddRef.current >= ACCEL_ADD_INTERVAL_MS) {
        lastAccelAddRef.current = now;
        const add = hold < 1 / 3 ? 1 : hold < 2 / 3 ? 2 : 5;
        setSpeed((s) => Math.min(MAX_SPEED_KMH, s + add));
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  const skierSource =
    state === 'left-ski' ? RIGHT_SKI_IMAGE
    : state === 'right-ski' ? LEFT_SKI_IMAGE
    : state === 'jump' ? JUMP_IMAGE
    : state === 'clumsy' ? CLUMSY_IMAGE
    : state === 'fall-florr' ? FALL_IMAGE
    : accelHold > 0 ? STAND_SKI_IMAGE
    : STAND_IMAGE;

  const curveTiltDeg = curveTiltAnim.interpolate({
    inputRange: [-CURVE_TILT_DEG - 2, CURVE_TILT_DEG + 2],
    outputRange: [-(CURVE_TILT_DEG + 2) + 'deg', (CURVE_TILT_DEG + 2) + 'deg'],
  });
  const curveCameraDeg = curveCameraAnim.interpolate({
    inputRange: [-5, 5],
    outputRange: ['-5deg', '5deg'],
  });

  const visibleSpawns = useMemo(() => {
    if (mode !== 'game' || spawnPlanRef.current.length === 0) return [];
    const plan = spawnPlanRef.current;
    const dist = distanceTraveledMeters;
    const minScroll = (dist - SPAWN_VIEW_BEHIND_M) / SCROLL_TO_METERS;
    const maxScroll = (dist + SPAWN_VIEW_AHEAD_M) / SCROLL_TO_METERS;
    let lo = 0;
    let hi = plan.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (plan[mid].scrollPx < minScroll) lo = mid + 1;
      else hi = mid;
    }
    const startIdx = lo;
    hi = plan.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (plan[mid].scrollPx <= maxScroll) lo = mid;
      else hi = mid - 1;
    }
    const endIdx = lo + 1;
    const result: Array<(SpawnPlanEntry & { id: string }) & { screenX: number; screenY: number }> = [];
    for (let i = startIdx; i < endIdx; i++) {
      const e = plan[i];
      if (collectedSpawnIdsRef.current.has(e.id)) continue;
      const entryDist = e.scrollPx * SCROLL_TO_METERS;
      const pathCenterAtSpawn =
        pathPoints?.length
          ? getPathCenterXPx(entryDist, pathPoints)
          : getProceduralPathCenterWorldX(e.scrollPx, SCREEN_WIDTH) - SCREEN_WIDTH / 2;
      const spawnRoadX = ROAD_CENTER_PX + e.worldX - SCREEN_WIDTH / 2 - pathCenterAtSpawn;
      const screenX = spawnRoadX - panX;
      const screenY = SKIER_SCREEN_Y - (entryDist - dist) * METERS_TO_STRIP_PX;
      result.push({ ...e, screenX, screenY });
    }
    return result.slice(0, MAX_VISIBLE_SPAWNS);
  }, [mode, distanceTraveledMeters, panX, pathPoints, collectedCount]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Animated.View
        style={[styles.sceneWrap, { transform: [{ rotate: curveCameraDeg }] }]}
        pointerEvents="none">
        <View style={styles.roadWrap}>
          <Animated.View
            style={[
              styles.roadStrip,
              {
                width: LAYOUT_WIDTH_PX,
                height: totalHeight,
                transform: [{ translateX: panXAnim }, { translateY }],
              },
            ]}>
            {tiles.map((src, i) => (
              <Image
                key={`tile-${i}`}
                source={src}
                style={[styles.tile, { top: i * TILE_HEIGHT, width: LAYOUT_WIDTH_PX, height: TILE_HEIGHT }]}
                resizeMode="stretch"
              />
            ))}
          </Animated.View>
        </View>
        {visibleSpawns.length > 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
            {visibleSpawns.map((s) => {
              if (s.kind === 'obstacle') {
                const obs = getObstacleById(s.itemId as string);
                const src = obs ? OBSTACLE_IMAGES[s.itemId as string] : null;
                if (!src) return null;
                const scale = (s.scaleFactor ?? 1) * 0.5;
                const w = obs ? Math.round(obs.width * scale) : 40;
                const h = obs ? Math.round(obs.height * scale) : 40;
                return (
                  <View
                    key={s.id}
                    style={[styles.spawnWrap, { transform: [{ translateX: s.screenX - w / 2 }, { translateY: s.screenY - h }] }]}
                  >
                    <Image source={src} style={{ width: w, height: h }} resizeMode="contain" />
                  </View>
                );
              }
              const emoji = s.kind === 'good' ? (GOOD_ITEMS.find((i) => i.id === s.itemId)?.emoji ?? '⭐') : (BAD_ITEMS.find((i) => i.id === s.itemId)?.emoji ?? '❌');
              return (
                <View key={s.id} style={[styles.spawnWrap, { transform: [{ translateX: s.screenX - 14 }, { translateY: s.screenY - 14 }] }]}>
                  <Text style={styles.spawnEmoji}>{emoji}</Text>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.skierPlaceholder}>
          <Animated.View
            style={[
              styles.skierWrap,
              {
                left: SCREEN_WIDTH / 2 - 30,
                transform: [{ translateX: charXAnim }, { rotate: curveTiltDeg }],
              },
            ]}>
            <Image source={skierSource} style={styles.skierImage} resizeMode="contain" />
          </Animated.View>
        </View>
      </Animated.View>
      {(mode === 'game' || mode === 'preview') && mission && pathPoints?.length ? (
        <MiniMap
          mission={mission}
          distanceTraveledMeters={distanceTraveledMeters}
          isOffPath={false}
          scenarioLabel={t(('scenario_' + mission.scenarioId) as 'scenario_delivery' | 'scenario_chase' | 'scenario_escape' | 'scenario_survival' | 'scenario_reach')}
          containerStyle={styles.miniMapRightCenter}
        />
      ) : null}
      <GamePad
        onLeft={() => {
          leftPressedAtRef.current = Date.now();
          if (state === 'stand-ski' || state === 'right-ski') setState('left-ski');
        }}
        onLeftRelease={() => {
          leftPressedAtRef.current = 0;
          if (rightPressedAtRef.current === 0 && (state === 'left-ski' || state === 'stand-ski')) setState('stand-ski');
        }}
        onRight={() => {
          rightPressedAtRef.current = Date.now();
          if (state === 'stand-ski' || state === 'left-ski') setState('right-ski');
        }}
        onRightRelease={() => {
          rightPressedAtRef.current = 0;
          if (leftPressedAtRef.current === 0 && (state === 'right-ski' || state === 'stand-ski')) setState('stand-ski');
        }}
        onAccel={() => {
          accelPressedAtRef.current = Date.now();
          setState('stand-ski');
        }}
        onAccelRelease={handleAccelRelease}
        onJumpPress={handleJumpPress}
        onJumpRelease={handleJumpRelease}
        leftTilt={leftTiltDisplay}
        rightTilt={rightTiltDisplay}
        accelTilt={accelHold}
        disabled={false}
      />
      {(mode === 'standalone' || mode === 'game') && (
        <View style={styles.speedBadge}>
          <Text style={styles.speedBadgeText}>{t('game_speedKmh', { speed: speed.toFixed(0) })}</Text>
        </View>
      )}
      {mode === 'game' && (
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeText}>{t('game_scoreDisplay', { score })}</Text>
        </View>
      )}
      {mode === 'game' ? (
        <View style={styles.inventoryBoxWrap} pointerEvents="none">
          <View style={styles.inventoryBox}>
            <View style={styles.inventoryRow}>
              <Text style={styles.inventoryEmoji}>🚀</Text>
              <Text style={styles.inventoryCount}>{t('game_inventoryCount', { count: rocketCount })}</Text>
            </View>
            <View style={styles.inventoryRow}>
              <Text style={styles.inventoryEmoji}>🛡️</Text>
              <Text style={styles.inventoryCount}>{t('game_inventoryCount', { count: extraLivesCount })}</Text>
            </View>
          </View>
        </View>
      ) : null}
      {mode === 'game' && lastCollectedItem ? (
        <View style={styles.roadSignWrap} pointerEvents="none">
          <View style={[styles.roadSign, { borderColor: lastCollectedItem.kind === 'good' ? '#16a34a' : '#dc2626' }]}>
            <Text style={styles.roadSignFormula} numberOfLines={1}>{lastCollectedItem.description}</Text>
          </View>
          <View style={styles.roadSignPole} />
        </View>
      ) : null}
      {(mode === 'standalone' || mode === 'game') && onBack ? (
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (mode === 'game' && onExit) onExit(scoreRef.current, distanceMetersRef.current);
            onBack();
          }}>
          <Text style={styles.backButtonText}>{t('entry_backWithArrow', { back: t('entry_back') })}</Text>
        </Pressable>
      ) : null}
      {mode === 'game' && gameWon && mission ? (
        <View style={styles.winOverlay} pointerEvents="box-none">
          <View style={styles.winCard}>
            <Text style={styles.winTitle}>🎉 {t('game_goalReached')} 🎉</Text>
            <Text style={styles.winKm}>{t('game_kmValue', { value: (mission.distanceMeters / 1000).toFixed(1) })}</Text>
            {completionBonus > 0 ? (
              <Text style={styles.winBonus}>{t('game_completionBonus', { bonus: completionBonus })}</Text>
            ) : null}
            <Pressable
              style={[styles.winButton, styles.winButtonPrimary]}
              onPress={() => {
                onExit?.(scoreRef.current, distanceMetersRef.current);
                onBack?.();
              }}>
              <Text style={styles.winButtonText}>{t('game_backToMenu')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {mode === 'game' && gameOver ? (
        <View style={styles.gameOverOverlay} pointerEvents="box-none">
          <View style={styles.gameOverCard}>
            <Text style={styles.gameOverTitle}>💥 {t('game_gameOver')}</Text>
            <Text style={styles.winKm}>{t('game_scoreDisplay', { score })}</Text>
            <Pressable
              style={[styles.gameOverButton, styles.gameOverButtonPrimary]}
              onPress={() => setRestartCount((r) => r + 1)}>
              <Text style={styles.gameOverButtonText}>{t('game_playAgain')}</Text>
            </Pressable>
            <Pressable
              style={[styles.gameOverButton, styles.gameOverButtonSecondary]}
              onPress={async () => {
                await onContinueWithAd?.();
                setExtraLivesCount((c) => c + 1);
                setGameOver(false);
                setState('stand-ski');
              }}>
              <View style={styles.gameOverButtonRow}>
                <Text style={styles.gameOverButtonText}>{t('game_continueWithAd')}</Text>
                <Text style={styles.gameOverAdIcon}>📺</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.gameOverButton, styles.gameOverButtonSecondary]}
              onPress={() => {
                onExit?.(scoreRef.current, distanceMetersRef.current);
                onBack?.();
              }}>
              <Text style={styles.gameOverButtonText}>{t('game_back')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {mode === 'rolling' && (
        <View style={styles.missionOverlay} pointerEvents="box-none">
          <Text style={styles.rollingOverlayLabel}>{t('entry_scenariosComing')}</Text>
        </View>
      )}
      {mode === 'preview' && mission && (
        <View style={styles.missionOverlay} pointerEvents="box-none">
          <View style={styles.previewCard}>
            <Text style={styles.previewCardTitle}>{t('entry_mission')}</Text>
            <Text style={styles.previewScenarioIcon}>
              {SCENARIO_THEMES.find((th) => th.id === mission.scenarioId)?.icon ?? '🎿'}
            </Text>
            <Text style={styles.previewScenarioName}>
              {t(('scenario_' + mission.scenarioId) as 'scenario_delivery' | 'scenario_chase' | 'scenario_escape' | 'scenario_survival' | 'scenario_reach')}
            </Text>
            <Text style={styles.previewKm}>{t('game_kmValue', { value: (mission.distanceMeters / 1000).toFixed(0) })}</Text>
            <TouchableOpacity
              style={[styles.previewButton, styles.previewButtonPrimary]}
              onPress={onStart}
              activeOpacity={0.8}>
              <Text style={styles.previewButtonText}>{t('entry_start')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.previewButton, styles.previewButtonSecondary]}
              onPress={onDifferent}
              activeOpacity={0.8}>
              <Text style={styles.previewButtonTextSecondary}>{t('entry_differentMission')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  sceneWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  roadWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  roadStrip: {
    width: SCREEN_WIDTH,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  tile: {
    position: 'absolute',
    left: 0,
    width: SCREEN_WIDTH,
    height: TILE_HEIGHT,
  },
  skierPlaceholder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 180,
    zIndex: 5,
  },
  skierWrap: {
    position: 'absolute',
    bottom: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skierImage: {
    width: 60,
    height: 80,
  },
  spawnWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  spawnEmoji: {
    fontSize: 28,
  },
  speedBadge: {
    position: 'absolute',
    top: 12,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderRadius: 10,
  },
  speedBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
  },
  scoreBadge: {
    position: 'absolute',
    top: 12,
    right: 16,
    marginTop: 48,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderRadius: 8,
  },
  scoreBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  inventoryBoxWrap: {
    position: 'absolute',
    left: 12,
    top: '36%',
    marginTop: -48,
    zIndex: 10,
  },
  inventoryBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.6)',
    minWidth: 72,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  inventoryEmoji: {
    fontSize: 20,
  },
  inventoryCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  roadSignWrap: {
    position: 'absolute',
    left: 12,
    top: '50%',
    marginTop: -56,
    zIndex: 10,
    alignItems: 'center',
  },
  roadSign: {
    backgroundColor: 'rgba(30, 41, 59, 0.88)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 4,
    borderColor: '#dc2626',
    minWidth: 76,
    maxWidth: 144,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
  },
  roadSignPole: {
    width: 6,
    height: 14,
    backgroundColor: '#78716c',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  roadSignFormula: {
    fontSize: 17,
    color: '#e2e8f0',
    textAlign: 'center',
    fontWeight: '800',
  },
  winOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  winCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 24,
    minWidth: 260,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.5)',
  },
  winTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fbbf24',
    marginBottom: 8,
    textAlign: 'center',
  },
  gameOverTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  gameOverCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderRadius: 16,
    padding: 24,
    minWidth: 260,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.5)',
  },
  gameOverButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 10,
  },
  gameOverButtonPrimary: {
    backgroundColor: '#0ea5e9',
  },
  gameOverButtonSecondary: {
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  gameOverButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gameOverButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  gameOverAdIcon: {
    fontSize: 16,
  },
  winKm: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 8,
  },
  winBonus: {
    fontSize: 15,
    color: '#86efac',
    marginBottom: 20,
  },
  winButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  winButtonPrimary: {
    backgroundColor: '#0ea5e9',
  },
  winButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderRadius: 12,
  },
  miniMapRightCenter: {
    left: undefined,
    right: 8,
    top: '50%',
    marginTop: -80,
    backgroundColor: 'rgba(15,23,42,0.4)',
  },
  backButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  missionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  rollingOverlayLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.5)',
    minWidth: 260,
    alignItems: 'center',
  },
  previewCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  previewScenarioIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  previewScenarioName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  previewKm: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  previewButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 8,
  },
  previewButtonPrimary: {
    backgroundColor: '#0ea5e9',
  },
  previewButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#64748b',
  },
  previewButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  previewButtonTextSecondary: {
    fontSize: 17,
    fontWeight: '600',
    color: '#94a3b8',
  },
});

export default RoadTestScreen;
