/**
 * Oyun ekranı - Hız fiziği (tab tab hızlanma), sınırsız sahne akışı, hız göstergesi
 */

import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
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
import ObstacleView, {type ObstacleSpawn} from '../components/ObstacleView';
import MiniMap from '../components/MiniMap';
import {
  GOOD_ITEMS,
  BAD_ITEMS,
  SPAWN_INTERVAL_PX,
  SPAWN_SCENE_CHANCE,
  BASE_SPAWN_CHANCE_OBSTACLE,
  BASE_SPAWN_CHANCE_GOOD,
  BASE_SPAWN_CHANCE_BAD,
  OBSTACLE_SIDE_BY_SIDE_2_CHANCE,
  OBSTACLE_SIDE_BY_SIDE_3_CHANCE,
  SUPER_SPEED_MULTIPLIER,
  SPEED_BOOST_ADD,
  type GoodItemId,
  type BadItemId,
} from '../constants/items';
import { OBSTACLE_LIST, getObstacleById } from '../constants/obstacles';

/** Kar yığını sadece yol sınırında; yol içi engeller ağaç/kaya. */
const OBSTACLE_LIST_FOR_SPAWN = OBSTACLE_LIST.filter(
  o => o.id !== 'snow-bank' && o.id !== 'snow-pile'
);
import {
  pickThoughtEmoji,
  EMOTIONS_HAPPY,
  EMOTIONS_SAD,
  EMOTIONS_SCARED,
  EMOTIONS_PANIC,
  EMOTIONS_NERVOUS,
  EMOTIONS_SKIING,
  EMOTIONS_BACK_TO_NORMAL,
  SPEED_SCARED_THRESHOLD,
  CLOSE_CALL_GAP_PX,
  BUBBLE_GOOD_MS,
  BUBBLE_BAD_MS,
  BUBBLE_PANIC_MS,
  BUBBLE_NERVOUS_MS,
  BUBBLE_NERVOUS_COOLDOWN_MS,
  BUBBLE_NERVOUS_CHANCE,
  BUBBLE_BACK_TO_NORMAL_MS,
  BUBBLE_SKIING_MIN_MS,
} from '../constants/emotions';
import {
  type Mission,
  SCENARIO_THEMES,
  getPathCenterXPx,
  getPathTurnAhead,
  SCROLL_TO_METERS,
  OFF_PATH_THRESHOLD_PX,
  SPAWN_CHANCE_OBSTACLE_OFF_PATH,
} from '../constants/missions';
import {
  getProceduralPathCenterWorldX,
  getTrackHalfWidthPx,
  getTrackBoundsAtScroll,
  getProceduralPathPoints,
  getProceduralPathTurnDirection,
} from '../constants/trackPath';
import { ROCKET_DURATION_MS, MAX_GOOD_SPAWN_LEVEL, MAX_BAD_SPAWN_LEVEL } from '../constants/upgrades';
import { useI18n } from '../i18n';

const CLUMSY_DURATION_MS = 500;
// Kar parçacıkları: sabit sayı, her frame sadece transform güncellenir (FPS dostu)
const SNOW_PARTICLE_COUNT = 25;
const SNOW_PARTICLE_SIZE = 4;
const SNOW_PARTICLE_SPEED_FACTOR = 0.35; // Hıza göre yukarı kayma
const ACCELERATE_DURATION_MS = 400;
const BASE_JUMP_DURATION_MS = 700; // Yükseltmeyle artar (initialJumpDurationMs)
const SEGMENT_HEIGHT = 600;
const DEFAULT_MAX_SPEED = 50; // Oyun birimi; yükseltmeyle artar
const MIN_SPEED = 5; // Minimum hız (km/s); kar kümelerinde ve diğer düşüşlerde bu değerin altına inmez
// Hızlanma: basılı tutma süresi ile ibre dolar; basılıyken bu aralıkla hız eklenir
const SCROLL_FACTOR = 0.18;
const ACCEL_RAMP_MS = 260; // Aynı sağa/sola gibi; bu sürede ibre 0→1 dolar
const ACCEL_ADD_INTERVAL_MS = 120; // Basılı tutarken bu aralıkla hız eklenir
const DASH_WIDTH = 18;
const DASH_GAP = 14;
const WAVE_AMP = 5;
const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const TRACK_HALF_WIDTH_PX = getTrackHalfWidthPx(SCREEN_WIDTH);
/** Kayakçı ekrandan taşmasın; yol ekrandan genişse sınır ekran kenarına indirgenir */
const SKIER_SCREEN_MARGIN = 44;
const MAX_SKIER_OFFSET_PX = Math.min(TRACK_HALF_WIDTH_PX, SCREEN_WIDTH / 2 - SKIER_SCREEN_MARGIN);
/** Keskin viraj pile spawn: aynı viraj için tekrar spawn cooldown (px) */
const TURN_PILE_SPAWN_COOLDOWN_PX = 400;
/** Top-down road layout: sadece pile sınırları; engel/item yok */
const ROAD_ONLY_MODE = true;
const BOUNDARY_PILE_INTERVAL_PX = 48;
/** Kamera: yumuşak easing (cinematic), mekanik kilit yok */
const CAMERA_EASE_FACTOR = 0.065;
/** İleri bakış: kamera yolun ilerisini gösterir, virajı oyuncu varmadan görür */
const LOOK_AHEAD_PX = 180;
const LOOK_AHEAD_Y_OFFSET = 100;
/** Virajda hafif kamera rotasyonu (derece) */
const STAGE_ROTATION_DEG = 2.5;
const STAGE_ROTATION_EASE_FACTOR = 0.08;
/** Temiz görünüm: UI/text gizle, sadece kayakçı + pile sınırları */
const CINEMATIC_VIEW = true;
/** Karakter ve engeller 3’te 1 oranında küçültülür; yol ekrana sığar, daha rahat kaçış. */
const GAME_VISUAL_SCALE = 1 / 3;
/** Zıplarken karakter hafif büyür (yukarıdan bakışta yaklaşma hissi), +20% */
const JUMP_SCALE_FACTOR = 1.2;
const STAGE_TILT_PX = 44;
const TILT_RAMP_MS = 260;
const TURN_SLOWDOWN_PCT = 0.1;
const HORIZONTAL_DRIFT_FACTOR = 0.038;
const SKIER_HIT_Y = SCREEN_HEIGHT - 220;
const SKIER_HIT_RANGE_Y = 55;
const SKIER_HIT_RANGE_X = 50;
const SKIER_HIT_RANGE_X_SCALED = SKIER_HIT_RANGE_X * GAME_VISUAL_SCALE;
const SKIER_HIT_RANGE_Y_SCALED = SKIER_HIT_RANGE_Y * GAME_VISUAL_SCALE;
/** Küçültmeden sonra çarpma/toplama geç tetikleniyordu: hit box aşağı uzatılıyor, üzerinden geçer geçmez algılansın */
const HIT_LEAD_Y_PX = 50;

type SpawnKind = 'obstacle' | 'good' | 'bad';
type Spawn = {
  id: string;
  kind: SpawnKind;
  itemId: string | GoodItemId | BadItemId;
  worldY: number;
  worldX: number;
  /** Engel için: kaya 2–3×, ağaç 1–1.25× rastgele ölçek */
  scaleFactor?: number;
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

const EXTRA_LIFE_INVINCIBLE_MS = 1800; // Ekstra can kullanınca kısa süre dokunulmaz

type GameScreenProps = {
  mission: Mission | null;
  totalEarned?: number;
  level?: number;
  /** İyi nesne sıklığı yükseltmesi (0..5 → +0..10%) */
  goodSpawnLevel?: number;
  /** Kötü nesne azaltma yükseltmesi (0..5 → -0..10%) */
  badSpawnLevel?: number;
  initialMaxSpeed?: number;
  initialJumpDurationMs?: number;
  initialRocketCount?: number;
  initialExtraLivesCount?: number;
  startWithGhostSeconds?: number;
  onExit?: (score: number, distanceMeters?: number) => void;
  onRunEnd?: (score: number) => void;
  onUseRocket?: () => void;
  onUseExtraLife?: () => void;
};

/** Oyun / seviyeye göre spawn oranları: iyi + kötü + engel = 100; level artınca engel artar. */
function getSpawnChances(
  level: number,
  goodSpawnLevel: number,
  badSpawnLevel: number
): { obstacle: number; good: number; bad: number } {
  const goodBonus = Math.min(goodSpawnLevel, MAX_GOOD_SPAWN_LEVEL) * 2;
  const badBonus = Math.min(badSpawnLevel, MAX_BAD_SPAWN_LEVEL) * 2;
  const levelPenalty = Math.max(0, level - 1);
  let good = Math.max(0, Math.min(100, BASE_SPAWN_CHANCE_GOOD - levelPenalty + goodBonus));
  let bad = Math.max(0, Math.min(100, BASE_SPAWN_CHANCE_BAD - levelPenalty - badBonus));
  let obstacle = 100 - good - bad;
  if (obstacle < 0) {
    obstacle = 0;
    const total = good + bad;
    if (total > 0) {
      good = Math.round((good / total) * 100);
      bad = Math.max(0, 100 - good);
    }
  } else if (obstacle > 100) {
    obstacle = 100;
    good = 0;
    bad = 0;
  }
  return { obstacle, good, bad };
}

function GameScreen({
  mission,
  totalEarned = 0,
  level = 1,
  goodSpawnLevel = 0,
  badSpawnLevel = 0,
  initialMaxSpeed = DEFAULT_MAX_SPEED,
  initialJumpDurationMs = BASE_JUMP_DURATION_MS,
  initialRocketCount = 0,
  initialExtraLivesCount = 0,
  startWithGhostSeconds = 0,
  onExit,
  onRunEnd,
  onUseRocket,
  onUseExtraLife,
}: GameScreenProps): React.JSX.Element {
  const { t } = useI18n();
  const maxSpeedRef = useRef(initialMaxSpeed);
  maxSpeedRef.current = initialMaxSpeed;
  const jumpDurationMsRef = useRef(initialJumpDurationMs);
  jumpDurationMsRef.current = initialJumpDurationMs;
  const reduceGhostRocketDropRef = useRef(initialRocketCount > 0 || startWithGhostSeconds > 0);
  reduceGhostRocketDropRef.current = initialRocketCount > 0 || startWithGhostSeconds > 0;
  const [state, setState] = useState<SkierState>('stand');
  const [gameWon, setGameWon] = useState(false);
  const gameWonRef = useRef(false);
  const [completionBonus, setCompletionBonus] = useState(0);
  const [rocketFlash, setRocketFlash] = useState(false);
  const [shieldFlash, setShieldFlash] = useState(false);
  const [distanceTraveledMeters, setDistanceTraveledMeters] = useState(0);
  const [rightEdgePile, setRightEdgePile] = useState<{ worldX: number; worldY: number } | null>(null);
  const freeSkiPathPoints = useMemo(
    () =>
      getProceduralPathPoints(
        distanceTraveledMeters / SCROLL_TO_METERS + 2000,
        120,
        SCREEN_WIDTH
      ),
    [distanceTraveledMeters]
  );
  const freeSkiTotalMeters = distanceTraveledMeters + 500;
  const [isOffPath, setIsOffPath] = useState(false);
  const [pathTurnAhead, setPathTurnAhead] = useState<'left' | 'right' | null>(null);
  const [boundaryHitAt, setBoundaryHitAt] = useState(0);
  const [speed, setSpeed] = useState(MIN_SPEED);
  const [accelHold, setAccelHold] = useState(0); // 0..1, basılı tutma ile dolar
  const hasCenterPressed = useRef(false);
  const speedRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const stageTranslateX = useRef(new Animated.Value(0)).current;
  const isDisabledRef = useRef(false);
  const accelPressedAtRef = useRef(0);
  const lastAccelAddRef = useRef(0);
  const lastJumpTapRef = useRef(0);
  const jumpPressedAtRef = useRef(0);
  const JUMP_DOUBLE_TAP_MS = 400;
  const JUMP_HOLD_THRESHOLD_MS = 200; // Basılı tutma eşiği
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  const [spawns, setSpawns] = useState<Spawn[]>([]);
  const spawnsRef = useRef<Spawn[]>([]);
  const spawnIdRef = useRef(0);
  const lastSpawnedScrollRef = useRef(0);
  const lastTurnPileSpawnedRef = useRef(0);
  const pathTurnAheadRef = useRef<'left' | 'right' | null>(null);
  const lastBoundaryPileSpawnedRef = useRef(0);
  const finishMarkerSpawnedRef = useRef(false);
  const totalScrollRef = useRef(0);
  const stateRef = useRef(state);
  const lastHitWasTreeRef = useRef(false); // Ağaç → fall-florr-back, kaya → fall-florr
  const jumpUntilRef = useRef(0); // Zıplarken kaya çarpması sayılmaz
  const ghostUntilRef = useRef(0);
  useEffect(() => {
    if (startWithGhostSeconds > 0) {
      ghostUntilRef.current = Date.now() + startWithGhostSeconds * 1000;
    }
  }, [startWithGhostSeconds]);
  const superSpeedUntilRef = useRef(0);
  const speedBoostUntilRef = useRef(0);
  const speedBoostAmountRef = useRef(0); // Toplam +40 bonus (süre bitince veya iptal tek seferde düşsün)
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
  const slideEndTimeRef = useRef<number>(0); // Düşünce süre burada donar
  const [slideDurationSec, setSlideDurationSec] = useState(0);
  const lastScoreTickRef = useRef(0);
  const [lastCollectedItem, setLastCollectedItem] = useState<{ emoji: string } | null>(null);
  const skierOffsetXRef = useRef(0);
  const skierOffsetXAnim = useRef(new Animated.Value(0)).current;
  const worldPanXRef = useRef(0);
  const worldPanXAnim = useRef(new Animated.Value(0)).current;
  const stageRotationRef = useRef(0);
  const stageRotationAnim = useRef(new Animated.Value(0)).current;
  const [particleAnims] = useState(() =>
    Array.from({ length: SNOW_PARTICLE_COUNT }, () => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(Math.random() * SCREEN_HEIGHT),
    }))
  );
  const particleXYRef = useRef<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const particleAnimsInitializedRef = useRef(false);
  const [popupMessage, setPopupMessage] = useState<string | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [buffRemaining, setBuffRemaining] = useState({ ghost: 0, superSpeed: 0, speedBoost: 0 });
  const [rocketCount, setRocketCount] = useState(initialRocketCount);
  const [extraLivesCount, setExtraLivesCount] = useState(initialExtraLivesCount);
  const extraLivesCountRef = useRef(initialExtraLivesCount);
  extraLivesCountRef.current = extraLivesCount;
  const invincibleUntilRef = useRef(0); // Ekstra can sonrası kısa süre dokunulmaz
  const lastGoodBubbleAtRef = useRef(0);
  const lastBadBubbleAtRef = useRef(0);
  const closeCallBubbleAtRef = useRef(0);
  const lastNervousAtRef = useRef(0);
  const lastSkiingAtRef = useRef(0);
  const lastBubbleCharRef = useRef<string | null>(null);
  /** Mevcut balon mood’u – interval tek olsun diye ref; emoji başka duruma geçmeden değişmez */
  const bubbleMoodRef = useRef<string | null>(null);
  const [bubbleEmoji, setBubbleEmoji] = useState<'happy' | 'sad' | 'scared' | 'panic' | 'nervous' | 'skiing' | 'backToNormal' | null>(null);
  const [bubbleChar, setBubbleChar] = useState<string>('');

  speedRef.current = speed;
  stateRef.current = state;
  isDisabledRef.current =
    state === 'clumsy' ||
    state === 'fall-florr' ||
    state === 'fall-florr-back' ||
    state === 'jump';
  spawnsRef.current = spawns;
  gameWonRef.current = gameWon;

  // Hızlanma ibresi: basılı tutma süresi ile 0..1 dolar; basılıyken sürekli hız eklenir
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
        setSpeed((s) => Math.min(maxSpeedRef.current, s + add));
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  // İlk açılış: stand → stand-ski
  useEffect(() => {
    const t = setTimeout(() => setState('stand-ski'), 800);
    return () => clearTimeout(t);
  }, []);

  // clumsy → fall-florr (kaya) veya fall-florr-back (ağaç)
  useEffect(() => {
    if (state !== 'clumsy') return;
    const t = setTimeout(
      () => setState(lastHitWasTreeRef.current ? 'fall-florr-back' : 'fall-florr'),
      CLUMSY_DURATION_MS
    );
    return () => clearTimeout(t);
  }, [state]);

  // jump → stand-ski (zıplama bitti; süre yükseltmeyle artar)
  useEffect(() => {
    if (state !== 'jump') return;
    const ms = jumpDurationMsRef.current;
    const t = setTimeout(() => setState('stand-ski'), ms);
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

  // Kayma süresi göstergesi (düşünce durur)
  useEffect(() => {
    const id = setInterval(() => {
      if (slideStartTimeRef.current === null) return;
      const end = slideEndTimeRef.current;
      const elapsed = end > 0
        ? Math.floor((end - slideStartTimeRef.current) / 1000)
        : Math.floor((Date.now() - slideStartTimeRef.current) / 1000);
      setSlideDurationSec(elapsed);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Kar parçacıkları: sayısal pozisyonları ref'te tut (her frame setValue, yeni eleman yok)
  useEffect(() => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < SNOW_PARTICLE_COUNT; i++) {
      x.push(Math.random() * SCREEN_WIDTH);
      y.push(Math.random() * SCREEN_HEIGHT);
    }
    particleXYRef.current = { x, y };
    particleAnims.forEach((p, i) => {
      p.x.setValue(x[i]);
      p.y.setValue(y[i]);
    });
    particleAnimsInitializedRef.current = true;
  }, [particleAnims]);

  // Popup: 2.5 s sonra kapan
  useEffect(() => {
    if (!popupMessage) return;
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => {
      setPopupMessage(null);
      popupTimeoutRef.current = null;
    }, 2500);
    return () => {
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    };
  }, [popupMessage]);

  // Buff geri sayımı: kafanın üstünde ikon + saniye göstermek için
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setBuffRemaining({
        ghost: Math.max(0, Math.ceil((ghostUntilRef.current - now) / 1000)),
        superSpeed: Math.max(0, Math.ceil((superSpeedUntilRef.current - now) / 1000)),
        speedBoost: Math.max(0, Math.ceil((speedBoostUntilRef.current - now) / 1000)),
      });
      const d = totalScrollRef.current * SCROLL_TO_METERS;
      setDistanceTraveledMeters(d);
      const scrollNow = scrollOffsetRef.current;
      const nearRight = !ROAD_ONLY_MODE && skierOffsetXRef.current > MAX_SKIER_OFFSET_PX - 60;
      if (nearRight) {
        const pathCenterX =
          mission && mission.points.length > 0
            ? SCREEN_WIDTH / 2 + getPathCenterXPx(d, mission.points)
            : getProceduralPathCenterWorldX(totalScrollRef.current, SCREEN_WIDTH);
        const rightX = pathCenterX + TRACK_HALF_WIDTH_PX - 30;
        const worldY = scrollNow + SCREEN_HEIGHT / 2 - 150;
        setRightEdgePile({ worldX: rightX, worldY });
      } else {
        setRightEdgePile(null);
      }
      if (mission && mission.points.length > 0) {
        const turn = getPathTurnAhead(d, mission.points);
        pathTurnAheadRef.current = turn;
        setIsOffPath(Math.abs(skierOffsetXRef.current) > OFF_PATH_THRESHOLD_PX);
        setPathTurnAhead(turn);
      } else {
        pathTurnAheadRef.current = null;
        setIsOffPath(Math.abs(skierOffsetXRef.current) > OFF_PATH_THRESHOLD_PX);
        setPathTurnAhead(null);
      }
    }, 400);
    return () => clearInterval(id);
  }, [mission]);

  useEffect(() => {
    if (boundaryHitAt <= 0) return;
    const t = setTimeout(() => setBoundaryHitAt(0), 2000);
    return () => clearTimeout(t);
  }, [boundaryHitAt]);

  // Düşünce balonu: bir şey olmadan emoji değişmez. Her durumda 1 emoji seçilir, o kalır.
  // Öncelik: panik > korku > mutsuz > mutlu > normale dönüş > tedirgin (sadece normal sürüşte) > kayak.
  // Normal sürüşte (kayak) sadece BUBBLE_SKIING_MIN_MS sonra yeni emoji seçilebilir (hızlandı daha fazla değişebilir).
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const spd = speedRef.current;
      const disabled = isDisabledRef.current;
      if (disabled) {
        bubbleMoodRef.current = null;
        setBubbleEmoji(null);
        setBubbleChar('');
        return;
      }

      const mood = bubbleMoodRef.current;

      // 1) Panik (engel yanından geçiş): ilk geçişte 1 emoji seç, o kalır
      if (now - closeCallBubbleAtRef.current < BUBBLE_PANIC_MS) {
        if (mood !== 'panic') {
          const picked = pickThoughtEmoji(EMOTIONS_PANIC, lastBubbleCharRef.current);
          lastBubbleCharRef.current = picked;
          bubbleMoodRef.current = 'panic';
          setBubbleEmoji('panic');
          setBubbleChar(picked);
        }
        return;
      }

      // 2) Korku (hız yüksek): ilk geçişte 1 emoji seç, o kalır
      if (spd >= SPEED_SCARED_THRESHOLD) {
        if (mood !== 'scared') {
          const picked = pickThoughtEmoji(EMOTIONS_SCARED, lastBubbleCharRef.current);
          lastBubbleCharRef.current = picked;
          bubbleMoodRef.current = 'scared';
          setBubbleEmoji('scared');
          setBubbleChar(picked);
        }
        return;
      }

      // 3) Mutsuz (kötü item): ilk geçişte 1 emoji seç, o kalır
      if (now - lastBadBubbleAtRef.current < BUBBLE_BAD_MS) {
        if (mood !== 'sad') {
          const picked = pickThoughtEmoji(EMOTIONS_SAD, lastBubbleCharRef.current);
          lastBubbleCharRef.current = picked;
          bubbleMoodRef.current = 'sad';
          setBubbleEmoji('sad');
          setBubbleChar(picked);
        }
        return;
      }

      // 4) Mutlu (iyi item): ilk geçişte 1 emoji seç, o kalır
      if (now - lastGoodBubbleAtRef.current < BUBBLE_GOOD_MS) {
        if (mood !== 'happy') {
          const picked = pickThoughtEmoji(EMOTIONS_HAPPY, lastBubbleCharRef.current);
          lastBubbleCharRef.current = picked;
          bubbleMoodRef.current = 'happy';
          setBubbleEmoji('happy');
          setBubbleChar(picked);
        }
        return;
      }

      // 5) Normale dönüş (mutsuzluk bittikten sonra kısa süre): ilk geçişte 1 emoji seç, o kalır
      const badEndedAt = lastBadBubbleAtRef.current + BUBBLE_BAD_MS;
      if (lastBadBubbleAtRef.current > 0 && now > badEndedAt && now - badEndedAt < BUBBLE_BACK_TO_NORMAL_MS) {
        if (mood !== 'backToNormal') {
          const picked = pickThoughtEmoji(EMOTIONS_BACK_TO_NORMAL, lastBubbleCharRef.current);
          lastBubbleCharRef.current = picked;
          bubbleMoodRef.current = 'backToNormal';
          setBubbleEmoji('backToNormal');
          setBubbleChar(picked);
        }
        return;
      }

      // 6) Tedirgin: sadece normal sürüşte (kayak mood) ve cooldown dolunca rastgele; 1 emoji seç, o kalır
      if (mood === 'nervous' && now - lastNervousAtRef.current <= BUBBLE_NERVOUS_MS) {
        return; // tedirgin penceresi devam ediyor, emoji değişmez
      }
      if (mood === 'nervous' && now - lastNervousAtRef.current > BUBBLE_NERVOUS_MS) {
        // tedirgin bitti → kayak moduna geç, 1 emoji seç (balonu silme)
        const picked = pickThoughtEmoji(EMOTIONS_SKIING, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        lastSkiingAtRef.current = now;
        bubbleMoodRef.current = 'skiing';
        setBubbleEmoji('skiing');
        setBubbleChar(picked);
        return;
      }
      // Tedirgin: sadece hareket varken (hız > 0), beklerken tetiklenmez
      if (spd > 0 && (mood === 'skiing' || mood === null) && now - lastNervousAtRef.current > BUBBLE_NERVOUS_COOLDOWN_MS) {
        if (Math.random() < BUBBLE_NERVOUS_CHANCE) {
          lastNervousAtRef.current = now;
          const picked = pickThoughtEmoji(EMOTIONS_NERVOUS, lastBubbleCharRef.current);
          lastBubbleCharRef.current = picked;
          bubbleMoodRef.current = 'nervous';
          setBubbleEmoji('nervous');
          setBubbleChar(picked);
          return;
        }
        // Tetiklenmediyse aşağıdaki kayak bloğuna düş (normal sürüşte emoji değişimi)
      }

      // 7) Normal kayak: oyun başında veya başka durumdan dönünce 1 emoji seç; normal sürüşte sadece BUBBLE_SKIING_MIN_MS sonra değişebilir
      const skiingIntervalPassed = lastSkiingAtRef.current === 0 || now - lastSkiingAtRef.current >= BUBBLE_SKIING_MIN_MS;
      if (mood !== 'skiing') {
        // Kayak moduna ilk geçiş: 1 emoji seç, o kalır
        const picked = pickThoughtEmoji(EMOTIONS_SKIING, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        lastSkiingAtRef.current = now;
        bubbleMoodRef.current = 'skiing';
        setBubbleEmoji('skiing');
        setBubbleChar(picked);
        return;
      }
      if (skiingIntervalPassed && spd > 0) {
        // Zaten kayak modunda, süre doldu ve hareket var: normal sürüşte hızlandı daha fazla değişebilir. Beklerken (hız 0) emoji değişmez.
        const picked = pickThoughtEmoji(EMOTIONS_SKIING, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        lastSkiingAtRef.current = now;
        setBubbleChar(picked);
      }
    }, 400);
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
      // Zıplarken frame akmaya ve hız devam eder; clumsy/fall veya hedefe ulaşınca dünya durur
      const worldPaused =
        gameWonRef.current ||
        st === 'clumsy' ||
        st === 'fall-florr' ||
        st === 'fall-florr-back';
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
      stageTranslateX.setValue(0);
      const tiltAmount = Math.max(leftTiltRef.current, rightTiltRef.current);
      const turnFactor = 1 - tiltAmount * TURN_SLOWDOWN_PCT;

      const superSpeed = now < superSpeedUntilRef.current;
      const badMult = badSpeedMultiplierRef.current;
      const effectiveSpeed =
        spd * (superSpeed ? SUPER_SPEED_MULTIPLIER : 1) * badMult * turnFactor;

      const totalScroll = totalScrollRef.current;
      const lookAheadScroll = totalScroll + LOOK_AHEAD_PX;
      const pathCenterWorldX =
        mission && mission.points.length > 0
          ? SCREEN_WIDTH / 2 + getPathCenterXPx(totalScroll * SCROLL_TO_METERS, mission.points)
          : getProceduralPathCenterWorldX(totalScroll, SCREEN_WIDTH);
      const pathCenterAheadX =
        mission && mission.points.length > 0
          ? SCREEN_WIDTH / 2 + getPathCenterXPx(lookAheadScroll * SCROLL_TO_METERS, mission.points)
          : getProceduralPathCenterWorldX(lookAheadScroll, SCREEN_WIDTH);

      // Yatay kayma: sadece basılıyken hareket; bırakınca ortaya dönme yok (ağaçtan kaçarken yerinde kal)
      if (!disabled) {
        const driftMultiplier = 1 + tiltAmount * 0.9;
        const driftPerFrame = effectiveSpeed * HORIZONTAL_DRIFT_FACTOR * driftMultiplier;
        const leftHeld = st === 'left-ski' && leftPressedAtRef.current > 0;
        const rightHeld = st === 'right-ski' && rightPressedAtRef.current > 0;
        if (driftPerFrame > 0 && leftHeld) {
          skierOffsetXRef.current -= driftPerFrame;
        } else if (driftPerFrame > 0 && rightHeld) {
          skierOffsetXRef.current += driftPerFrame;
        }
      }
      // Sınır: yol genişliği kadar ama ekrandan taşma; tam yatay hareket özgürlüğü
      const clamped = Math.max(-MAX_SKIER_OFFSET_PX, Math.min(MAX_SKIER_OFFSET_PX, skierOffsetXRef.current));
      skierOffsetXRef.current = clamped;
      skierOffsetXAnim.setValue(skierOffsetXRef.current);
      // Kamera: ileri bakış – yolun ilerisini gösterir (path center ahead), viraj önceden görünür
      const targetWorldPanX = SCREEN_WIDTH / 2 - pathCenterAheadX - skierOffsetXRef.current * 0.4;
      worldPanXRef.current += (targetWorldPanX - worldPanXRef.current) * CAMERA_EASE_FACTOR;
      worldPanXAnim.setValue(worldPanXRef.current);
      // Virajda hafif kamera rotasyonu (2–3°), aynı yönde (ileri bakışla uyumlu)
      const turnDir =
        mission && pathTurnAheadRef.current !== null
          ? (pathTurnAheadRef.current === 'left' ? -1 : pathTurnAheadRef.current === 'right' ? 1 : 0)
          : getProceduralPathTurnDirection(lookAheadScroll, SCREEN_WIDTH);
      const targetRotation = turnDir * STAGE_ROTATION_DEG;
      stageRotationRef.current += (targetRotation - stageRotationRef.current) * STAGE_ROTATION_EASE_FACTOR;
      stageRotationAnim.setValue(stageRotationRef.current);

      // Kar parçacıkları: sadece pozisyon güncelle, ekran dışına çıkanı karşı kenardan al
      if (particleAnimsInitializedRef.current && particleXYRef.current.x.length === SNOW_PARTICLE_COUNT) {
        const dx = worldPaused ? 0 : effectiveSpeed * SNOW_PARTICLE_SPEED_FACTOR;
        const xy = particleXYRef.current;
        for (let i = 0; i < SNOW_PARTICLE_COUNT; i++) {
          xy.y[i] += dx;
          xy.x[i] += (Math.random() - 0.5) * 0.8;
          if (xy.y[i] > SCREEN_HEIGHT + SNOW_PARTICLE_SIZE * 2) {
            xy.y[i] = -Math.random() * 40;
            xy.x[i] = Math.random() * SCREEN_WIDTH;
          }
          if (xy.x[i] < -20) xy.x[i] = SCREEN_WIDTH + 10;
          if (xy.x[i] > SCREEN_WIDTH + 20) xy.x[i] = -10;
          particleAnims[i].x.setValue(xy.x[i]);
          particleAnims[i].y.setValue(xy.y[i]);
        }
      }

      if (!worldPaused && effectiveSpeed > 0) {
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
        scrollAnim.setValue(scrollOffsetRef.current - LOOK_AHEAD_Y_OFFSET);
      }

      const scrollNow = scrollOffsetRef.current;

      if (mission && !gameWonRef.current) {
        const distanceMeters = totalScrollRef.current * SCROLL_TO_METERS;
        if (distanceMeters >= mission.distanceMeters) {
          gameWonRef.current = true;
          setGameWon(true);
          // Tamamlama bonusu: mesafe (km başına 50) + zorluk (curveIntensity × 100)
          const distanceBonus = Math.round((mission.distanceMeters / 1000) * 50);
          const theme = SCENARIO_THEMES.find(t => t.id === mission.scenarioId);
          const difficultyBonus = theme ? Math.round(theme.curveIntensity * 100) : 0;
          const totalBonus = distanceBonus + difficultyBonus;
          setCompletionBonus(totalBonus);
          setScore(prev => prev + totalBonus);
        }
      }

      // Path merkezi spawn Y'de (yol sınırları içinde spawn)
      const spawnWorldY = scrollNow - SCREEN_HEIGHT - 320 + Math.random() * 200;
      const pathCenterAtSpawn =
        mission && mission.points.length > 0
          ? SCREEN_WIDTH / 2 + getPathCenterXPx(spawnWorldY * SCROLL_TO_METERS, mission.points)
          : getProceduralPathCenterWorldX(spawnWorldY, SCREEN_WIDTH);
      const trackHalf = getTrackHalfWidthPx(SCREEN_WIDTH);
      const spawnMargin = trackHalf * 0.88;
      const randomInTrack = () => pathCenterAtSpawn + (Math.random() - 0.5) * 2 * spawnMargin;

      const { obstacle: spawnObstacleChance, good: spawnGoodChance, bad: spawnBadChance } =
        getSpawnChances(level, goodSpawnLevel, badSpawnLevel);
      const obstacleChance =
        mission && mission.points.length > 0
          ? (Math.abs(skierOffsetXRef.current) > OFF_PATH_THRESHOLD_PX
              ? SPAWN_CHANCE_OBSTACLE_OFF_PATH
              : spawnObstacleChance)
          : spawnObstacleChance;
      const remaining = 100 - obstacleChance;
      const goodRatio = spawnGoodChance + spawnBadChance > 0 ? spawnGoodChance / (spawnGoodChance + spawnBadChance) : 0.5;
      const goodThreshold = obstacleChance + (obstacleChance === spawnObstacleChance ? spawnGoodChance : remaining * goodRatio);

      if (
        !ROAD_ONLY_MODE &&
        !worldPaused &&
        spd > 0 &&
        totalScrollRef.current - lastSpawnedScrollRef.current > SPAWN_INTERVAL_PX
      ) {
        lastSpawnedScrollRef.current = totalScrollRef.current;
        if (Math.random() < SPAWN_SCENE_CHANCE) {
          const worldY = spawnWorldY;
          const roll = Math.random() * 100;
          if (roll < obstacleChance) {
            const sideRoll = Math.random();
            const count = sideRoll < OBSTACLE_SIDE_BY_SIDE_3_CHANCE ? 3
              : sideRoll < OBSTACLE_SIDE_BY_SIDE_2_CHANCE ? 2 : 1;
            const newSpawns: Spawn[] = [];
            for (let i = 0; i < count; i++) {
              const worldX = count === 1
                ? randomInTrack()
                : pathCenterAtSpawn + (Math.random() - 0.5) * spawnMargin * 1.6;
              const entry = pickByWeight(OBSTACLE_LIST_FOR_SPAWN);
              const isRock = entry.id.startsWith('rock');
              const scaleFactor = isRock
                ? 2 + Math.random()
                : 1 + Math.random() * 0.25;
              newSpawns.push({
                id: `spawn-${++spawnIdRef.current}`,
                kind: 'obstacle',
                itemId: entry.id,
                worldY,
                worldX,
                scaleFactor,
              });
            }
            const next = [...spawnsRef.current, ...newSpawns];
            spawnsRef.current = next;
            setSpawns(next);
          } else if (roll < goodThreshold) {
            const worldX = randomInTrack();
            const goodPool = reduceGhostRocketDropRef.current
              ? GOOD_ITEMS.map((i) =>
                  i.id === 'ghost' || i.id === 'rocket'
                    ? { ...i, weight: Math.max(1, Math.floor(i.weight / 3)) }
                    : i
                )
              : GOOD_ITEMS;
            const itemId = pickByWeight(goodPool).id;
            const next = [...spawnsRef.current, {
              id: `spawn-${++spawnIdRef.current}`,
              kind: 'good' as const,
              itemId: itemId as GoodItemId,
              worldY,
              worldX,
            }];
            spawnsRef.current = next;
            setSpawns(next);
          } else {
            const worldX = randomInTrack();
            const itemId = pickByWeight(BAD_ITEMS).id;
            const next = [...spawnsRef.current, {
              id: `spawn-${++spawnIdRef.current}`,
              kind: 'bad' as const,
              itemId: itemId as BadItemId,
              worldY,
              worldX,
            }];
            spawnsRef.current = next;
            setSpawns(next);
          }
        }
      }

      // Road-only: sadece sanal sınır sonları pile (55×100), bitiş işareti; long-pile yok
      if (ROAD_ONLY_MODE && !worldPaused && spd > 0) {
        const totalScroll = totalScrollRef.current;
        if (totalScroll - lastBoundaryPileSpawnedRef.current > BOUNDARY_PILE_INTERVAL_PX) {
          lastBoundaryPileSpawnedRef.current = totalScroll;
          const boundaryY = scrollNow - SCREEN_HEIGHT - 200;
          const rowScrollPos = totalScroll - scrollNow + boundaryY;
          const pathCenterX =
            mission && mission.points.length > 0
              ? SCREEN_WIDTH / 2 + getPathCenterXPx(rowScrollPos * SCROLL_TO_METERS, mission.points)
              : getProceduralPathCenterWorldX(rowScrollPos, SCREEN_WIDTH);
          const leftX = pathCenterX - TRACK_HALF_WIDTH_PX;
          const rightX = pathCenterX + TRACK_HALF_WIDTH_PX;
          const newPiles: Spawn[] = [
            {
              id: `spawn-${++spawnIdRef.current}`,
              kind: 'obstacle',
              itemId: 'snow-pile',
              worldY: boundaryY,
              worldX: leftX,
              scaleFactor: 1,
            },
            {
              id: `spawn-${++spawnIdRef.current}`,
              kind: 'obstacle',
              itemId: 'snow-pile',
              worldY: boundaryY,
              worldX: rightX,
              scaleFactor: 1,
            },
          ];
          const next = [...spawnsRef.current, ...newPiles];
          spawnsRef.current = next;
          setSpawns(next);
        }
        if (
          mission &&
          mission.points.length > 0 &&
          !finishMarkerSpawnedRef.current &&
          totalScrollRef.current * SCROLL_TO_METERS >= mission.distanceMeters - 200
        ) {
          finishMarkerSpawnedRef.current = true;
          const pathCenterFinish =
            SCREEN_WIDTH / 2 + getPathCenterXPx(mission.distanceMeters, mission.points);
          const finishY = scrollNow + 180;
          const finishPile: Spawn = {
            id: `spawn-${++spawnIdRef.current}`,
            kind: 'obstacle',
            itemId: 'snow-pile',
            worldY: finishY,
            worldX: pathCenterFinish,
            scaleFactor: 1,
          };
          const next = [...spawnsRef.current, finishPile];
          spawnsRef.current = next;
          setSpawns(next);
        }
      }

      // Keskin viraj: sağa viraj varsa sağ kenara 3–4 pile yan yana koy (mecbur sola kaç)
      if (
        !ROAD_ONLY_MODE &&
        !worldPaused &&
        spd > 0 &&
        pathTurnAheadRef.current === 'right' &&
        totalScrollRef.current - lastTurnPileSpawnedRef.current > TURN_PILE_SPAWN_COOLDOWN_PX
      ) {
        lastTurnPileSpawnedRef.current = totalScrollRef.current;
        const aheadY = scrollNow + 120;
        const rowScrollPos = totalScrollRef.current - scrollNow + aheadY;
        const pathCenterX =
          mission && mission.points.length > 0
            ? SCREEN_WIDTH / 2 + getPathCenterXPx(rowScrollPos * SCROLL_TO_METERS, mission.points)
            : getProceduralPathCenterWorldX(rowScrollPos, SCREEN_WIDTH);
        const rightEdgeX = pathCenterX + TRACK_HALF_WIDTH_PX - 50;
        const count = 4;
        const turnPiles: Spawn[] = [];
        for (let i = 0; i < count; i++) {
          turnPiles.push({
            id: `spawn-${++spawnIdRef.current}`,
            kind: 'obstacle',
            itemId: 'snow-bank',
            worldY: aheadY + i * 80,
            worldX: rightEdgeX - i * 100,
            scaleFactor: 1,
          });
        }
        const next = [...spawnsRef.current, ...turnPiles];
        spawnsRef.current = next;
        setSpawns(next);
      }
      if (
        !ROAD_ONLY_MODE &&
        !worldPaused &&
        spd > 0 &&
        pathTurnAheadRef.current === 'left' &&
        totalScrollRef.current - lastTurnPileSpawnedRef.current > TURN_PILE_SPAWN_COOLDOWN_PX
      ) {
        lastTurnPileSpawnedRef.current = totalScrollRef.current;
        const aheadY = scrollNow + 120;
        const rowScrollPos = totalScrollRef.current - scrollNow + aheadY;
        const pathCenterX =
          mission && mission.points.length > 0
            ? SCREEN_WIDTH / 2 + getPathCenterXPx(rowScrollPos * SCROLL_TO_METERS, mission.points)
            : getProceduralPathCenterWorldX(rowScrollPos, SCREEN_WIDTH);
        const leftEdgeX = pathCenterX - TRACK_HALF_WIDTH_PX + 50;
        const count = 4;
        const turnPiles: Spawn[] = [];
        for (let i = 0; i < count; i++) {
          turnPiles.push({
            id: `spawn-${++spawnIdRef.current}`,
            kind: 'obstacle',
            itemId: 'snow-bank',
            worldY: aheadY + i * 80,
            worldX: leftEdgeX + i * 100,
            scaleFactor: 1,
          });
        }
        const next = [...spawnsRef.current, ...turnPiles];
        spawnsRef.current = next;
        setSpawns(next);
      }

      // Sadece iyice ekranın altına çıkanları kaldır (üzerinden geçtikten sonra)
      const stillVisible = spawnsRef.current.filter(
        s => s.worldY + scrollNow < SCREEN_HEIGHT + 250,
      );
      if (stillVisible.length !== spawnsRef.current.length) {
        spawnsRef.current = stillVisible;
        setSpawns(stillVisible);
      }

      // Etki süreleri: bad effect bitince çarpan 1; speed_boost bitince +40 geri al
      if (now > badEffectUntilRef.current) badSpeedMultiplierRef.current = 1;
      if (speedBoostUntilRef.current > 0 && now > speedBoostUntilRef.current) {
        const amt = speedBoostAmountRef.current;
        speedBoostUntilRef.current = 0;
        speedBoostAmountRef.current = 0;
        if (amt > 0) setSpeed(prev => Math.max(MIN_SPEED, prev - amt));
      }

      // Çarpışma: engeller görsel dikdörtgenle (taş/ağaç aynı), emoji spawn merkeziyle (zıplarken de çalışır)
      if (!worldPaused) {
        const ghost = now < ghostUntilRef.current;
        const invincible = now < invincibleUntilRef.current; // Ekstra can sonrası
        const skierX = SCREEN_WIDTH / 2 + skierOffsetXRef.current;
        const skierTop = SKIER_HIT_Y - SKIER_HIT_RANGE_Y_SCALED;
        const skierBottom = SKIER_HIT_Y + SKIER_HIT_RANGE_Y_SCALED + HIT_LEAD_Y_PX;
        const halfW = SKIER_HIT_RANGE_X_SCALED;
        // Engel çarpışması: duran = orta 1/3 (ağaç gibi), sola kayarken = sol yarı, sağa = sağ yarı (resim çerçevesi büyük olduğu için yan geçişte çarpmasın)
        let obstSkierLeft: number;
        let obstSkierRight: number;
        if (st === 'left-ski') {
          obstSkierLeft = skierX - halfW;
          obstSkierRight = skierX;
        } else if (st === 'right-ski') {
          obstSkierLeft = skierX;
          obstSkierRight = skierX + halfW;
        } else {
          obstSkierLeft = skierX - halfW / 3;
          obstSkierRight = skierX + halfW / 3;
        }

        for (const s of spawnsRef.current) {
          const screenY = s.worldY + scrollNow;
          const screenX = s.worldX + worldPanXRef.current;

          let hit: boolean;
          if (s.kind === 'obstacle') {
            const obs = getObstacleById(s.itemId as string);
            if (!obs) continue;
            const scale = (s.scaleFactor ?? 1) * GAME_VISUAL_SCALE;
            const w = Math.round(obs.width * scale);
            const h = Math.round(obs.height * scale);
            const isTree = (s.itemId as string).startsWith('tree');
            // Ağaç: sadece orta üçte bir (kök/gövde) çarpmış sayılır; kaya: tüm dikdörtgen
            const hitLeft = isTree ? screenX - w / 6 : screenX - w / 2;
            const hitRight = isTree ? screenX + w / 6 : screenX + w / 2;
            const obsTop = screenY - h;
            const obsBottom = screenY;
            hit =
              obstSkierLeft < hitRight &&
              obstSkierRight > hitLeft &&
              skierTop < obsBottom &&
              skierBottom > obsTop;
            if (!hit) {
              const vertOverlap = skierTop < obsBottom && skierBottom > obsTop;
              const obsLeft = screenX - w / 2;
              const obsRight = screenX + w / 2;
              const gap =
                obstSkierRight < obsLeft
                  ? obsLeft - obstSkierRight
                  : obstSkierLeft > obsRight
                    ? obstSkierLeft - obsRight
                    : 0;
              if (vertOverlap && gap > 0 && gap < CLOSE_CALL_GAP_PX) {
                closeCallBubbleAtRef.current = now;
              }
            }
          } else {
            hit =
              screenY >= skierTop &&
              screenY <= skierBottom &&
              Math.abs(screenX - skierX) < SKIER_HIT_RANGE_X_SCALED;
          }
          if (!hit) continue;

          // Zıplarken yerdeki itemlerin (good/bad) üzerinden geç – temas sayılmaz
          if (now < jumpUntilRef.current && (s.kind === 'good' || s.kind === 'bad')) continue;

          if (s.kind === 'obstacle') {
            if (s.itemId === 'snow-bank' || s.itemId === 'snow-pile') {
              // Sınır (kar yığını): düşme yok; sadece %50 hız kaybı (min 5 km/s)
              setSpeed(prev => Math.max(MIN_SPEED, prev * 0.5));
              setBoundaryHitAt(now);
              break;
            }
            const isTree = (s.itemId as string).startsWith('tree');
            if (!isTree && now < jumpUntilRef.current) {
              break;
            }
            const obs = getObstacleById(s.itemId as string);
            if (obs?.description) setPopupMessage(obs.description);
            if (ghost || invincible) {
              break;
            }
            if (extraLivesCountRef.current > 0) {
              extraLivesCountRef.current -= 1;
              setExtraLivesCount(extraLivesCountRef.current);
              setShieldFlash(true);
              setTimeout(() => setShieldFlash(false), 400);
              onUseExtraLife?.();
              invincibleUntilRef.current = now + EXTRA_LIFE_INVINCIBLE_MS;
              break;
            }
            lastHitWasTreeRef.current = isTree;
            slideEndTimeRef.current = now;
            setState('clumsy');
            break;
          }
          if (s.kind === 'good') {
            const def = GOOD_ITEMS.find(g => g.id === s.itemId);
            if (def) {
              if (def.effect === 'inventory_rocket') {
                setRocketCount((c) => {
                  const n = c + 1;
                  setPopupMessage(`🚀 ×${n}`);
                  return n;
                });
              } else if (def.effect === 'inventory_shield') {
                setExtraLivesCount((c) => {
                  const n = c + 1;
                  setPopupMessage(`🛡️ ×${n}`);
                  return n;
                });
              } else {
                setPopupMessage(def.description);
              }
              if (def.points) setScore(prev => prev + def.points);
              if (def.effect === 'ghost') {
                ghostUntilRef.current = now + def.durationMs;
              } else if (def.effect === 'super_speed') {
                superSpeedUntilRef.current = now + def.durationMs;
              } else if (def.effect === 'speed_boost') {
                const add = SPEED_BOOST_ADD;
                setSpeed(prev => prev + add);
                speedBoostAmountRef.current += add;
                speedBoostUntilRef.current = now + def.durationMs;
              }
              setLastCollectedItem({ emoji: def.emoji });
              lastGoodBubbleAtRef.current = now;
            }
            const next = spawnsRef.current.filter(x => x.id !== s.id);
            spawnsRef.current = next;
            setSpawns(next);
            break;
          }
          if (s.kind === 'bad') {
            const def = BAD_ITEMS.find(b => b.id === s.itemId);
            if (def) {
              setPopupMessage(def.description);
              // Olumsuz item: iyi buff’ları iptal et (hayalet, süper hız, hız bonusu)
              ghostUntilRef.current = 0;
              superSpeedUntilRef.current = 0;
              if (speedBoostUntilRef.current > 0) {
                const amt = speedBoostAmountRef.current;
                speedBoostUntilRef.current = 0;
                speedBoostAmountRef.current = 0;
                if (amt > 0) setSpeed(prev => Math.max(MIN_SPEED, prev - amt));
              }
              if (def.durationMs > 0) {
                badEffectUntilRef.current = now + def.durationMs;
                badSpeedMultiplierRef.current = def.speedMultiplier;
              } else {
                setSpeed(prev => Math.max(MIN_SPEED, prev * def.speedMultiplier));
              }
              const penalty = def.scorePenalty;
              if (penalty != null) setScore(prev => Math.max(0, prev + penalty));
              setLastCollectedItem({ emoji: def.emoji });
              lastBadBubbleAtRef.current = now;
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

  const handleJumpPress = useCallback(() => {
    const now = Date.now();
    jumpPressedAtRef.current = now;
    
    // Hızlı çift tıklama kontrolü: roket varsa turbo aktif et
    if (now - lastJumpTapRef.current < JUMP_DOUBLE_TAP_MS && rocketCount > 0) {
      lastJumpTapRef.current = 0;
      jumpPressedAtRef.current = 0; // Basılı tutma iptal
      superSpeedUntilRef.current = now + ROCKET_DURATION_MS;
      setRocketCount((c) => c - 1);
      setRocketFlash(true);
      setTimeout(() => setRocketFlash(false), 400);
      onUseRocket?.();
      return;
    }
    
    lastJumpTapRef.current = now;
  }, [rocketCount, onUseRocket]);

  const handleJumpRelease = useCallback(() => {
    const now = Date.now();
    const pressDuration = now - jumpPressedAtRef.current;
    jumpPressedAtRef.current = 0;
    
    // Basılı tutma süresi eşiği geçtiyse ve disabled değilse zıpla
    if (pressDuration >= JUMP_HOLD_THRESHOLD_MS && !isDisabledRef.current) {
      setState('jump');
      jumpUntilRef.current = now + jumpDurationMsRef.current;
    }
  }, []);

  const handleAccelPress = useCallback(() => {
    hasCenterPressed.current = true;
    setState('stand');
    accelPressedAtRef.current = Date.now();
  }, []);

  const handleAccelRelease = useCallback(() => {
    accelPressedAtRef.current = 0;
    setAccelHold(0);
  }, []);

  const handleRestart = useCallback(() => {
    onRunEnd?.(scoreRef.current);
    setState('stand');
    setSpeed(MIN_SPEED);
    setScore(0);
    setSpawns([]);
    spawnsRef.current = [];
    lastSpawnedScrollRef.current = 0;
    lastTurnPileSpawnedRef.current = 0;
    lastBoundaryPileSpawnedRef.current = 0;
    finishMarkerSpawnedRef.current = false;
    totalScrollRef.current = 0;
    ghostUntilRef.current = 0;
    superSpeedUntilRef.current = 0;
    speedBoostUntilRef.current = 0;
    speedBoostAmountRef.current = 0;
    badEffectUntilRef.current = 0;
    badSpeedMultiplierRef.current = 1;
    slideStartTimeRef.current = null;
    slideEndTimeRef.current = 0;
    setSlideDurationSec(0);
    setLastCollectedItem(null);
    setPopupMessage(null);
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = null;
    skierOffsetXRef.current = 0;
    skierOffsetXAnim.setValue(0);
    leftPressedAtRef.current = 0;
    rightPressedAtRef.current = 0;
    accelPressedAtRef.current = 0;
    lastJumpTapRef.current = 0;
    jumpPressedAtRef.current = 0;
    setAccelHold(0);
    leftTiltRef.current = 0;
    rightTiltRef.current = 0;
    lastGoodBubbleAtRef.current = 0;
    lastBadBubbleAtRef.current = 0;
    closeCallBubbleAtRef.current = 0;
    setBubbleEmoji(null);
    setBubbleChar('');
    lastBubbleCharRef.current = null;
    lastNervousAtRef.current = 0;
    lastSkiingAtRef.current = 0;
    setGameWon(false);
    gameWonRef.current = false;
    setDistanceTraveledMeters(0);
    setRightEdgePile(null);
    setBoundaryHitAt(0);
    worldPanXRef.current = 0;
    worldPanXAnim.setValue(0);
    stageRotationRef.current = 0;
    stageRotationAnim.setValue(0);
    if (particleXYRef.current.x.length === SNOW_PARTICLE_COUNT) {
      for (let i = 0; i < SNOW_PARTICLE_COUNT; i++) {
        const x = Math.random() * SCREEN_WIDTH;
        const y = Math.random() * SCREEN_HEIGHT;
        particleXYRef.current.x[i] = x;
        particleXYRef.current.y[i] = y;
        particleAnims[i].x.setValue(x);
        particleAnims[i].y.setValue(y);
      }
    }
  }, [onRunEnd, particleAnims]);

  const isDisabled =
    state === 'clumsy' ||
    state === 'fall-florr' ||
    state === 'fall-florr-back' ||
    state === 'jump';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {!CINEMATIC_VIEW && (mission || distanceTraveledMeters > 0) ? (
        <MiniMap
          mission={mission}
          distanceTraveledMeters={distanceTraveledMeters}
          isOffPath={isOffPath}
          scenarioLabel={mission ? t(('scenario_' + mission.scenarioId) as 'scenario_delivery' | 'scenario_chase' | 'scenario_escape' | 'scenario_survival' | 'scenario_reach') : t('entry_freeSki')}
          freeSkiPathPoints={mission ? undefined : freeSkiPathPoints}
          freeSkiTotalMeters={mission ? undefined : freeSkiTotalMeters}
        />
      ) : null}

      {!CINEMATIC_VIEW && mission && pathTurnAhead ? (
        <View style={styles.pathArrowWrap} pointerEvents="none">
          <Text style={styles.pathArrow}>
            {pathTurnAhead === 'left' ? '←' : '→'}
          </Text>
        </View>
      ) : null}

      {!CINEMATIC_VIEW && boundaryHitAt > 0 ? (
        <View style={styles.boundarySignWrap} pointerEvents="none">
          <View style={styles.boundarySign}>
            <Text style={styles.boundarySignIcon}>⚠</Text>
            <Text style={styles.boundarySignText}>Sınır – hız %50</Text>
          </View>
        </View>
      ) : null}

      {gameWon && mission ? (
        <View style={styles.winOverlay} pointerEvents="box-none">
          <Text style={styles.winTitle}>🎉 {t('game_goalReached')} 🎉</Text>
          <View style={styles.winMissionCard}>
            <Text style={styles.winMissionIcon}>
              {SCENARIO_THEMES.find(t => t.id === mission.scenarioId)?.icon ?? '🎯'}
            </Text>
            <Text style={styles.winMissionName}>
              {t(('scenario_' + mission.scenarioId) as 'scenario_delivery' | 'scenario_chase' | 'scenario_escape' | 'scenario_survival' | 'scenario_reach')}
            </Text>
            <Text style={styles.winMissionDistance}>
              {(mission.distanceMeters / 1000).toFixed(1)} km
            </Text>
          </View>
          <Text style={styles.winMissionComplete}>{t('game_missionComplete')}</Text>
          {completionBonus > 0 ? (
            <Text style={styles.winBonus}>{t('game_completionBonus', { bonus: completionBonus })}</Text>
          ) : null}
          <View style={styles.winButtonRow}>
            <Pressable style={[styles.winButton, styles.winButtonSecondary]} onPress={() => onExit?.(scoreRef.current, undefined)}>
              <Text style={styles.winButtonIcon}>🚪</Text>
              <Text style={styles.winButtonText}>{t('game_backToMenu')}</Text>
            </Pressable>
            <Pressable style={[styles.winButton, styles.winButtonPrimary]} onPress={handleRestart}>
              <Text style={styles.winButtonIcon}>🔄</Text>
              <Text style={styles.winButtonText}>{t('game_playAgain')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Gökyüzü bandının altı: sabit beyaz zemin + kar parçacıkları */}
      <View style={styles.stageWrap} pointerEvents="none">
        <View style={styles.fixedSnowBackground} />
        <View style={styles.particlesWrap} pointerEvents="none">
          {particleAnims.map((p, i) => (
            <Animated.View
              key={`particle-${i}`}
              style={[styles.snowParticle, { left: p.x, top: p.y }]}
            />
          ))}
        </View>
        <Animated.View
          style={[
            styles.stage,
            {
              transform: [
                {translateY: scrollAnim},
                {translateX: Animated.add(stageTranslateX, worldPanXAnim)},
                {
                  rotate: stageRotationAnim.interpolate({
                    inputRange: [-5, 5],
                    outputRange: ['-5deg', '5deg'],
                  }),
                },
              ],
            },
          ]}>
          {/* Kenar bariyeri: sadece kar yığını (long-pile / pile) seyrek spawn – ince çizgi View’lar kaldırıldı (performans) */}
          {rightEdgePile ? (
            <Image
              source={require('../assets/snows/long-pile.png')}
              style={[
                styles.rightEdgePile,
                {
                  left: rightEdgePile.worldX,
                  top: rightEdgePile.worldY - 300,
                  width: 60,
                  height: 300,
                },
              ]}
              resizeMode="contain"
            />
          ) : null}
          {spawns.map(s => {
            if (s.kind === 'obstacle') {
              return <ObstacleView key={s.id} spawn={s as ObstacleSpawn} globalScale={GAME_VISUAL_SCALE} />;
            }
            const emoji =
              s.kind === 'good'
                ? GOOD_ITEMS.find(g => g.id === s.itemId)?.emoji ?? '❓'
                : BAD_ITEMS.find(b => b.id === s.itemId)?.emoji ?? '❓';
            return (
              <View
                key={s.id}
                style={[styles.emojiItemPlain, { left: s.worldX - 14, top: s.worldY - 14 }]}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </View>
            );
          })}
        </Animated.View>
      </View>

      {!CINEMATIC_VIEW ? (
      <View style={styles.leftPanel}>
        <View style={styles.leftPanelRow}>
          <Text style={styles.leftPanelIcon}>Lv</Text>
          <Text style={styles.leftPanelValue}>{level}</Text>
        </View>
        <View style={styles.leftPanelRow}>
          <Text style={styles.leftPanelIcon}>📈</Text>
          <Text style={styles.leftPanelValue}>{totalEarned}</Text>
        </View>
        {mission === null ? (
          <View style={styles.leftPanelRow}>
            <Text style={styles.leftPanelIcon}>📏</Text>
            <Text style={styles.leftPanelValue}>
              {distanceTraveledMeters >= 1000
                ? `${(distanceTraveledMeters / 1000).toFixed(1)} km`
                : `${Math.round(distanceTraveledMeters)} m`}
            </Text>
          </View>
        ) : null}
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
      ) : null}

      {!CINEMATIC_VIEW ? (
      <View style={styles.speedTubeWrap}>
        <Text style={styles.speedTubeMax}>{maxSpeedRef.current}</Text>
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
                height: `${accelHold * 100}%`,
                backgroundColor:
                  accelHold >= 2 / 3
                    ? 'rgba(239, 68, 68, 0.8)'
                    : accelHold >= 1 / 3
                      ? 'rgba(234, 179, 8, 0.8)'
                      : 'rgba(34, 197, 94, 0.8)',
              },
            ]}
          />
        </View>
        <Text style={styles.speedTubeValue}>{speed.toFixed(0)}</Text>
      </View>
      ) : null}

      {/* Sağda: roket + kalkan slotları; cinematic'te gizli, sadece skier kalır */}
      <View style={styles.inventoryWrap}>
        {!CINEMATIC_VIEW ? (
        <>
        <Pressable
          style={({ pressed }) => [
            styles.inventorySlot,
            (isDisabled || rocketCount <= 0) && styles.inventorySlotDisabled,
            pressed && !isDisabled && rocketCount > 0 && styles.inventorySlotPressed,
            rocketFlash && styles.inventorySlotFlash,
          ]}
          onPress={() => {
            if (isDisabled || rocketCount <= 0) return;
            const now = Date.now();
            superSpeedUntilRef.current = now + ROCKET_DURATION_MS;
            setRocketCount((c) => c - 1);
            setRocketFlash(true);
            setTimeout(() => setRocketFlash(false), 400);
            onUseRocket?.();
          }}
          disabled={isDisabled}>
          <Text style={styles.inventoryEmoji}>🚀</Text>
          <Text style={styles.inventoryCount}>×{rocketCount}</Text>
        </Pressable>
        <View style={[styles.inventorySlot, shieldFlash && styles.inventorySlotFlash]}>
          <Text style={styles.inventoryEmoji}>🛡️</Text>
          <Text style={styles.inventoryCount}>×{extraLivesCount}</Text>
        </View>
        </>
        ) : null}
      </View>

      {/* Popup: item/engel açıklaması (şeffaf balon) */}
      {!CINEMATIC_VIEW && popupMessage ? (
        <View style={styles.popupWrap}>
          <View style={styles.popupBalloon}>
            <Text style={styles.popupText}>{popupMessage}</Text>
          </View>
        </View>
      ) : null}

      {/* Sağ üst: Çıkış + Yeniden başlat (cinematic'te de kalır) */}
      <View style={styles.topRight}>
        {onExit ? (
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              const dist = mission === null ? Math.round(totalScrollRef.current * SCROLL_TO_METERS) : undefined;
              onExit(scoreRef.current, dist);
            }}>
            <Text style={styles.iconButtonText}>🚪</Text>
          </Pressable>
        ) : null}
        {state === 'fall-florr' || state === 'fall-florr-back' ? (
          <Pressable style={styles.iconButton} onPress={handleRestart}>
            <Text style={styles.iconButtonText}>🔄</Text>
          </Pressable>
        ) : state === 'clumsy' || state === 'jump' ? (
          <View style={styles.iconButtonDisabled} pointerEvents="none">
            <Text style={styles.iconButtonText}>...</Text>
          </View>
        ) : (
          <Pressable style={styles.iconButton} onPress={handleFall}>
            <Text style={styles.iconButtonText}>🔄</Text>
          </Pressable>
        )}
      </View>

      {/* Kayakçı – yatay kayma ile sınırsız sola/sağa */}
      <View style={styles.skierWrap}>
        {/* Kafanın üstünde aktif buff’lar: ikon + geri sayım (sn) */}
        {!CINEMATIC_VIEW ? (
        <View style={styles.buffBarWrap}>
          {buffRemaining.ghost > 0 && (
            <View style={styles.buffBadge}>
              <Text style={styles.buffIcon}>👻</Text>
              <Text style={styles.buffSec}>{buffRemaining.ghost}s</Text>
            </View>
          )}
          {buffRemaining.superSpeed > 0 && (
            <View style={styles.buffBadge}>
              <Text style={styles.buffIcon}>🚀</Text>
              <Text style={styles.buffSec}>{buffRemaining.superSpeed}s</Text>
            </View>
          )}
          {buffRemaining.speedBoost > 0 && (
            <View style={styles.buffBadge}>
              <Text style={styles.buffIcon}>⚡</Text>
              <Text style={styles.buffSec}>{buffRemaining.speedBoost}s</Text>
            </View>
          )}
        </View>
        ) : null}
        <Animated.View
          style={[
            styles.skierColumn,
            { transform: [{ translateX: skierOffsetXAnim }] },
          ]}>
          {!CINEMATIC_VIEW && bubbleChar ? (
            <View style={styles.thoughtBubbleWrap}>
              <View style={styles.thoughtBubble}>
                <Text style={styles.thoughtBubbleEmoji}>{bubbleChar}</Text>
              </View>
            </View>
          ) : null}
          <View
            style={[
              styles.skierFrame,
              {
                transform: [
                  {
                    scale:
                      state === 'jump'
                        ? GAME_VISUAL_SCALE * JUMP_SCALE_FACTOR
                        : GAME_VISUAL_SCALE,
                  },
                ],
              },
            ]}>
            <Image
              source={SKYGUY_IMAGES[state]}
              style={state === 'right-ski' ? styles.skier : styles.skier}
              resizeMode="contain"
            />
          </View>
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
        onRight={() => {
          rightPressedAtRef.current = Date.now();
          setState('right-ski');
        }}
        onRightRelease={() => {
          rightPressedAtRef.current = 0;
          setState('stand-ski');
        }}
        onAccel={handleAccelPress}
        onAccelRelease={handleAccelRelease}
        onJumpPress={handleJumpPress}
        onJumpRelease={handleJumpRelease}
        leftTilt={leftTiltDisplay}
        rightTilt={rightTiltDisplay}
        accelTilt={accelHold}
        disabled={isDisabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e8eef4',
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
  fixedSnowBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ecf0f6',
  },
  particlesWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  snowParticle: {
    position: 'absolute',
    width: SNOW_PARTICLE_SIZE,
    height: SNOW_PARTICLE_SIZE,
    borderRadius: SNOW_PARTICLE_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
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
  speedTubeMax: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(148, 163, 184, 0.95)',
    marginBottom: 4,
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
  inventoryWrap: {
    position: 'absolute',
    right: 12,
    top: SCREEN_HEIGHT * 0.16,
    zIndex: 20,
    flexDirection: 'column',
    gap: 8,
  },
  inventorySlot: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    alignItems: 'center',
    minWidth: 56,
  },
  inventorySlotDisabled: {
    opacity: 0.5,
  },
  inventorySlotPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  inventorySlotFlash: {
    borderColor: '#22c55e',
    borderWidth: 3,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  inventoryEmoji: {
    fontSize: 22,
  },
  inventoryCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    marginTop: 2,
  },
  pathArrowWrap: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 19,
    pointerEvents: 'none',
  },
  pathArrow: {
    fontSize: 36,
    fontWeight: '800',
    color: 'rgba(15, 23, 42, 0.75)',
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  boundarySignWrap: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 21,
  },
  boundarySign: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(71, 85, 105, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    gap: 6,
  },
  boundarySignIcon: {
    fontSize: 18,
  },
  boundarySignText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  topRight: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    backgroundColor: '#64748b',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    backgroundColor: '#94a3b8',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 22,
  },
  rightEdgePile: {
    position: 'absolute',
  },
  emojiItemPlain: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
  winOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    elevation: 100,
    padding: 24,
  },
  winTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fbbf24',
    marginBottom: 24,
    textAlign: 'center',
  },
  winMissionCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 16,
    minWidth: 280,
  },
  winMissionIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  winMissionName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
    textAlign: 'center',
  },
  winMissionDistance: {
    fontSize: 16,
    color: '#94a3b8',
  },
  winMissionComplete: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 8,
  },
  winBonus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fbbf24',
    marginBottom: 24,
  },
  winButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  winButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 140,
    justifyContent: 'center',
  },
  winButtonPrimary: {
    backgroundColor: '#0ea5e9',
  },
  winButtonSecondary: {
    backgroundColor: '#64748b',
  },
  winButtonIcon: {
    fontSize: 20,
  },
  winButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  popupWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SCREEN_HEIGHT * 0.28,
    alignItems: 'center',
    zIndex: 25,
    pointerEvents: 'none',
  },
  popupBalloon: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    maxWidth: SCREEN_WIDTH * 0.85,
  },
  popupText: {
    fontSize: 18,
    color: '#f1f5f9',
    textAlign: 'center',
  },
  skierColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  thoughtBubbleWrap: {
    marginBottom: 6,
    alignItems: 'center',
  },
  thoughtBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: 'rgba(100, 116, 139, 0.4)',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thoughtBubbleEmoji: {
    fontSize: 28,
  },
  buffBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  buffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    gap: 2,
  },
  buffIcon: {
    fontSize: 14,
  },
  buffSec: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f1f5f9',
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
