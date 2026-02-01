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
import ObstacleView, {type ObstacleSpawn} from '../components/ObstacleView';
import MiniMap from '../components/MiniMap';
import {
  GOOD_ITEMS,
  BAD_ITEMS,
  SPAWN_INTERVAL_PX,
  SPAWN_SCENE_CHANCE,
  SPAWN_CHANCE_OBSTACLE,
  SPAWN_CHANCE_GOOD,
  SPAWN_CHANCE_BAD,
  OBSTACLE_SIDE_BY_SIDE_2_CHANCE,
  OBSTACLE_SIDE_BY_SIDE_3_CHANCE,
  SUPER_SPEED_MULTIPLIER,
  SPEED_BOOST_ADD,
  type GoodItemId,
  type BadItemId,
} from '../constants/items';
import { OBSTACLE_LIST, getObstacleById } from '../constants/obstacles';
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
import { ROCKET_DURATION_MS } from '../constants/upgrades';
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
// Hızlanma: basılı tutma süresi ile ibre dolar; basılıyken bu aralıkla hız eklenir
const SCROLL_FACTOR = 0.18;
const ACCEL_RAMP_MS = 260; // Aynı sağa/sola gibi; bu sürede ibre 0→1 dolar
const ACCEL_ADD_INTERVAL_MS = 120; // Basılı tutarken bu aralıkla hız eklenir
const DASH_WIDTH = 18;
const DASH_GAP = 14;
const WAVE_AMP = 5;
const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
// Dönüş: basılı tutulunca daha keskin sağa/sola (tilt ve drift artırıldı, ramp hızlandı)
const STAGE_TILT_PX = 44;
const TILT_RAMP_MS = 260;
const TURN_SLOWDOWN_PCT = 0.1;
const HORIZONTAL_DRIFT_FACTOR = 0.038;
const CENTER_RETURN_SPEED = 6;
const SKIER_HIT_Y = SCREEN_HEIGHT - 220;
const SKIER_HIT_RANGE_Y = 55;
const SKIER_HIT_RANGE_X = 50;

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

function GameScreen({
  mission,
  totalEarned = 0,
  level = 1,
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
  const [isOffPath, setIsOffPath] = useState(false);
  const [pathTurnAhead, setPathTurnAhead] = useState<'left' | 'right' | null>(null);
  const [speed, setSpeed] = useState(0);
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
      if (mission) {
        setDistanceTraveledMeters(d);
        if (mission.points.length > 0) {
          const pathCenterX = getPathCenterXPx(d, mission.points);
          const skierX = skierOffsetXRef.current + worldPanXRef.current;
          setIsOffPath(Math.abs(skierX - pathCenterX) > OFF_PATH_THRESHOLD_PX);
          setPathTurnAhead(getPathTurnAhead(d, mission.points));
        } else {
          setIsOffPath(false);
          setPathTurnAhead(null);
        }
      } else {
        setDistanceTraveledMeters(d);
        setIsOffPath(false);
        setPathTurnAhead(null);
      }
    }, 400);
    return () => clearInterval(id);
  }, [mission]);

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
      // Zıplarken frame akmaya ve hız devam eder; sadece clumsy/fall'da dünya durur
      const worldPaused =
        st === 'clumsy' || st === 'fall-florr' || st === 'fall-florr-back';
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
      const tiltAmount = Math.max(leftTiltRef.current, rightTiltRef.current);
      const turnFactor = 1 - tiltAmount * TURN_SLOWDOWN_PCT;

      const superSpeed = now < superSpeedUntilRef.current;
      const badMult = badSpeedMultiplierRef.current;
      const effectiveSpeed =
        spd * (superSpeed ? SUPER_SPEED_MULTIPLIER : 1) * badMult * turnFactor;

      // Yatay kayma: açı arttıkça daha çok yan gider (tam bası ≈ ekrandan çıkabilecek kadar)
      if (!disabled) {
        const driftMultiplier = 1 + tiltAmount * 0.9;
        const driftPerFrame = effectiveSpeed * HORIZONTAL_DRIFT_FACTOR * driftMultiplier;
        const leftHeld = st === 'left-ski' && leftPressedAtRef.current > 0;
        const rightHeld = st === 'right-ski' && rightPressedAtRef.current > 0;
        if (driftPerFrame > 0 && leftHeld) {
          skierOffsetXRef.current -= driftPerFrame;
        } else if (driftPerFrame > 0 && rightHeld) {
          skierOffsetXRef.current += driftPerFrame;
        } else {
          // Hız yok veya tuş bırakıldı: ortaya animatik dönüş
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
        scrollAnim.setValue(scrollOffsetRef.current);
      }

      const scrollNow = scrollOffsetRef.current;
      const totalScroll = totalScrollRef.current;

      if (mission && !gameWonRef.current) {
        const distanceMeters = totalScroll * SCROLL_TO_METERS;
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

      // Spawn: path dışındaysa daha çok engel
      const obstacleChance =
        mission && mission.points.length > 0
          ? (() => {
              const distanceMeters = totalScroll * SCROLL_TO_METERS;
              const pathCenterX = getPathCenterXPx(distanceMeters, mission.points);
              const skierOffsetFromPath =
                skierOffsetXRef.current + worldPanXRef.current - pathCenterX;
              return Math.abs(skierOffsetFromPath) > OFF_PATH_THRESHOLD_PX
                ? SPAWN_CHANCE_OBSTACLE_OFF_PATH
                : SPAWN_CHANCE_OBSTACLE;
            })()
          : SPAWN_CHANCE_OBSTACLE;

      if (
        !worldPaused &&
        spd > 0 &&
        totalScroll - lastSpawnedScrollRef.current > SPAWN_INTERVAL_PX
      ) {
        lastSpawnedScrollRef.current = totalScroll;
        if (Math.random() < SPAWN_SCENE_CHANCE) {
          const worldY =
            scrollNow - SCREEN_HEIGHT - 320 + Math.random() * 200;
          const roll = Math.random() * 100;
          if (roll < obstacleChance) {
            // Engel: 1, 2 veya 3 yan yana (şans faktörüne göre)
            const sideRoll = Math.random();
            const count = sideRoll < OBSTACLE_SIDE_BY_SIDE_3_CHANCE ? 3
              : sideRoll < OBSTACLE_SIDE_BY_SIDE_2_CHANCE ? 2 : 1;
            const margin = SCREEN_WIDTH * 0.15;
            const step = count === 1 ? 0 : (SCREEN_WIDTH - 2 * margin) / (count + 1);
            const newSpawns: Spawn[] = [];
            for (let i = 0; i < count; i++) {
              const worldX = count === 1
                ? margin + Math.random() * (SCREEN_WIDTH - 2 * margin)
                : margin + step * (i + 1) + (Math.random() - 0.5) * (step * 0.4);
              const entry = pickByWeight(OBSTACLE_LIST);
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
          } else if (roll < SPAWN_CHANCE_OBSTACLE + SPAWN_CHANCE_GOOD) {
            const worldX = SCREEN_WIDTH * 0.2 + Math.random() * SCREEN_WIDTH * 0.6;
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
            const worldX = SCREEN_WIDTH * 0.2 + Math.random() * SCREEN_WIDTH * 0.6;
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
        if (amt > 0) setSpeed(prev => Math.max(0, prev - amt));
      }

      // Çarpışma: engeller görsel dikdörtgenle (taş/ağaç aynı), emoji spawn merkeziyle (zıplarken de çalışır)
      if (!worldPaused) {
        const ghost = now < ghostUntilRef.current;
        const invincible = now < invincibleUntilRef.current; // Ekstra can sonrası
        const skierX = SCREEN_WIDTH / 2 + skierOffsetXRef.current;
        const skierLeft = skierX - SKIER_HIT_RANGE_X;
        const skierRight = skierX + SKIER_HIT_RANGE_X;
        const skierTop = SKIER_HIT_Y - SKIER_HIT_RANGE_Y;
        const skierBottom = SKIER_HIT_Y + SKIER_HIT_RANGE_Y;

        for (const s of spawnsRef.current) {
          const screenY = s.worldY + scrollNow;
          const screenX = s.worldX + tiltAmountRef.current + worldPanXRef.current;

          let hit: boolean;
          if (s.kind === 'obstacle') {
            const obs = getObstacleById(s.itemId as string);
            if (!obs) continue;
            const scale = s.scaleFactor ?? 1;
            const w = Math.round(obs.width * scale);
            const h = Math.round(obs.height * scale);
            const isTree = (s.itemId as string).startsWith('tree');
            // Ağaç: sadece orta üçte bir (kök/gövde) çarpmış sayılır; kaya: tüm dikdörtgen
            const hitLeft = isTree ? screenX - w / 6 : screenX - w / 2;
            const hitRight = isTree ? screenX + w / 6 : screenX + w / 2;
            const obsTop = screenY - h;
            const obsBottom = screenY;
            hit =
              skierLeft < hitRight &&
              skierRight > hitLeft &&
              skierTop < obsBottom &&
              skierBottom > obsTop;
            if (!hit) {
              const vertOverlap = skierTop < obsBottom && skierBottom > obsTop;
              const obsLeft = screenX - w / 2;
              const obsRight = screenX + w / 2;
              const gap =
                skierRight < obsLeft
                  ? obsLeft - skierRight
                  : skierLeft > obsRight
                    ? skierLeft - obsRight
                    : 0;
              if (vertOverlap && gap > 0 && gap < CLOSE_CALL_GAP_PX) {
                closeCallBubbleAtRef.current = now;
              }
            }
          } else {
            hit =
              Math.abs(screenY - SKIER_HIT_Y) < SKIER_HIT_RANGE_Y &&
              Math.abs(screenX - skierX) < SKIER_HIT_RANGE_X;
          }
          if (!hit) continue;

          // Zıplarken yerdeki itemlerin (good/bad) üzerinden geç – temas sayılmaz
          if (now < jumpUntilRef.current && (s.kind === 'good' || s.kind === 'bad')) continue;

          if (s.kind === 'obstacle') {
            const isTree = (s.itemId as string).startsWith('tree');
            // Zıplarken kayaya çarpmayı sayma – kayanın üzerinden geç
            if (!isTree && now < jumpUntilRef.current) {
              break; // Zıplayarak kayadan kaçtı, engel kaybolmasın
            }
            const obs = getObstacleById(s.itemId as string);
            if (obs?.description) setPopupMessage(obs.description);
            
            // Engeller artık kaybolmaz (ne ağaç ne kaya)
            
            if (ghost || invincible) {
              break; // Hayalet veya ekstra can sonrası dokunulmaz: düşme
            }
            if (extraLivesCountRef.current > 0) {
              extraLivesCountRef.current -= 1;
              setExtraLivesCount(extraLivesCountRef.current);
              setShieldFlash(true);
              setTimeout(() => setShieldFlash(false), 400);
              onUseExtraLife?.();
              invincibleUntilRef.current = now + EXTRA_LIFE_INVINCIBLE_MS;
              break; // Bir can tüketildi, kaldığı yerden devam
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
                if (amt > 0) setSpeed(prev => Math.max(0, prev - amt));
              }
              if (def.durationMs > 0) {
                badEffectUntilRef.current = now + def.durationMs;
                badSpeedMultiplierRef.current = def.speedMultiplier;
              } else {
                setSpeed(prev => Math.max(0, prev * def.speedMultiplier));
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
    setSpeed(0);
    setScore(0);
    setSpawns([]);
    spawnsRef.current = [];
    lastSpawnedScrollRef.current = 0;
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
    worldPanXRef.current = 0;
    worldPanXAnim.setValue(0);
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
      <StatusBar barStyle="dark-content" backgroundColor="#e8eef4" />

      {mission ? (
        <MiniMap
          mission={mission}
          distanceTraveledMeters={distanceTraveledMeters}
          isOffPath={isOffPath}
          scenarioLabel={t(('scenario_' + mission.scenarioId) as 'scenario_delivery' | 'scenario_chase' | 'scenario_escape' | 'scenario_survival' | 'scenario_reach')}
        />
      ) : null}

      {/* Dönüşe gelirken üstte yön oku */}
      {mission && pathTurnAhead ? (
        <View style={styles.pathArrowWrap} pointerEvents="none">
          <Text style={styles.pathArrow}>
            {pathTurnAhead === 'left' ? '←' : '→'}
          </Text>
        </View>
      ) : null}

      {gameWon && mission ? (
        <View style={styles.winOverlay}>
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

      {/* Sabit beyaz zemin + kar parçacıkları (sabit sayı, sadece pozisyon güncellenir) */}
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
              ],
            },
          ]}>
          {spawns.map(s => {
            if (s.kind === 'obstacle') {
              return <ObstacleView key={s.id} spawn={s as ObstacleSpawn} />;
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

      {/* Sol orta: kompakt panel – lv, toplam kazanç, mesafe (serbest kay), hız, koşu puanı, süre, son item */}
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

      {/* Sağa yaslı: max hız üstte, hız tüpü, anlık hız altta */}
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

      {/* Sağda: roket + kalkan slotları (yoksa ×0, varsa adet) */}
      <View style={styles.inventoryWrap}>
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
      </View>

      {/* Popup: item/engel açıklaması (şeffaf balon) */}
      {popupMessage ? (
        <View style={styles.popupWrap}>
          <View style={styles.popupBalloon}>
            <Text style={styles.popupText}>{popupMessage}</Text>
          </View>
        </View>
      ) : null}

      {/* Sağ üst: Çıkış (kapı) + Yeniden başlat (reload) */}
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
          <View style={styles.iconButtonDisabled}>
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
        <Animated.View
          style={[
            styles.skierColumn,
            { transform: [{ translateX: skierOffsetXAnim }] },
          ]}>
          {bubbleChar ? (
            <View style={styles.thoughtBubbleWrap}>
              <View style={styles.thoughtBubble}>
                <Text style={styles.thoughtBubbleEmoji}>{bubbleChar}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.skierFrame}>
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
    zIndex: 30,
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
