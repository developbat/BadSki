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

const CLUMSY_DURATION_MS = 500;
const ACCELERATE_DURATION_MS = 400;
const SEGMENT_HEIGHT = 600;
const MAX_SPEED = 300;
// Hızlanma ibresine göre: yeşil +1, sarı +2, kırmızı +5 (tapRate 0–3 yeşil, 4–6 sarı, 7+ kırmızı)
// Ekran akma hızı: delta = effectiveSpeed × SCROLL_FACTOR (hız arttıkça çizgiler belirgin şekilde hızlı akar)
const SCROLL_FACTOR = 0.18;
const TAP_RATE_WINDOW_MS = 1000;
const MAX_TAP_RATE = 10;
const DASH_WIDTH = 18;
const DASH_GAP = 14;
const WAVE_AMP = 5;
const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const DASHES_PER_ROW = Math.ceil(SCREEN_WIDTH / (DASH_WIDTH + DASH_GAP)) + 2;
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
  const tapRateRef = useRef(0);
  const [score, setScore] = useState(0);
  const [spawns, setSpawns] = useState<Spawn[]>([]);
  const spawnsRef = useRef<Spawn[]>([]);
  const spawnIdRef = useRef(0);
  const lastSpawnedScrollRef = useRef(0);
  const totalScrollRef = useRef(0);
  const stateRef = useRef(state);
  const ghostUntilRef = useRef(0);
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
  const [popupMessage, setPopupMessage] = useState<string | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [buffRemaining, setBuffRemaining] = useState({ ghost: 0, superSpeed: 0, speedBoost: 0 });
  const lastGoodBubbleAtRef = useRef(0);
  const lastBadBubbleAtRef = useRef(0);
  const closeCallBubbleAtRef = useRef(0);
  const lastNervousAtRef = useRef(0);
  const lastSkiingAtRef = useRef(0);
  const lastBubbleCharRef = useRef<string | null>(null);
  const [bubbleEmoji, setBubbleEmoji] = useState<'happy' | 'sad' | 'scared' | 'panic' | 'nervous' | 'skiing' | 'backToNormal' | null>(null);
  const [bubbleChar, setBubbleChar] = useState<string>('');

  speedRef.current = speed;
  stateRef.current = state;
  isDisabledRef.current = state === 'clumsy' || state === 'fall-florr';
  spawnsRef.current = spawns;

  // Tab hızı göstergesi: son 1 saniyedeki basış sayısını güncelle (ibre + hızlanma oranı için)
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      tapTimestampsRef.current = tapTimestampsRef.current.filter(
        t => now - t < TAP_RATE_WINDOW_MS,
      );
      const rate = tapTimestampsRef.current.length;
      tapRateRef.current = rate;
      setTapRate(rate);
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
    }, 400);
    return () => clearInterval(id);
  }, []);

  // Düşünce balonu: duruma göre yüz emojisi (öncelik: panik > korku > mutsuz > mutlu > rasgele tedirgin)
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const spd = speedRef.current;
      const disabled = isDisabledRef.current;
      if (disabled) {
        setBubbleEmoji(null);
        setBubbleChar('');
        return;
      }
      if (now - closeCallBubbleAtRef.current < BUBBLE_PANIC_MS) {
        const picked = pickThoughtEmoji(EMOTIONS_PANIC, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        setBubbleEmoji('panic');
        setBubbleChar(picked);
        return;
      }
      if (spd >= SPEED_SCARED_THRESHOLD) {
        const picked = pickThoughtEmoji(EMOTIONS_SCARED, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        setBubbleEmoji('scared');
        setBubbleChar(picked);
        return;
      }
      if (now - lastBadBubbleAtRef.current < BUBBLE_BAD_MS) {
        const picked = pickThoughtEmoji(EMOTIONS_SAD, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        setBubbleEmoji('sad');
        setBubbleChar(picked);
        return;
      }
      if (now - lastGoodBubbleAtRef.current < BUBBLE_GOOD_MS) {
        const picked = pickThoughtEmoji(EMOTIONS_HAPPY, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        setBubbleEmoji('happy');
        setBubbleChar(picked);
        return;
      }
      const badEndedAt = lastBadBubbleAtRef.current + BUBBLE_BAD_MS;
      if (lastBadBubbleAtRef.current > 0 && now > badEndedAt && now - badEndedAt < BUBBLE_BACK_TO_NORMAL_MS) {
        const picked = pickThoughtEmoji(EMOTIONS_BACK_TO_NORMAL, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        setBubbleEmoji('backToNormal');
        setBubbleChar(picked);
        return;
      }
      if (lastNervousAtRef.current > 0 && now - lastNervousAtRef.current <= BUBBLE_NERVOUS_MS) {
        return;
      }
      if (bubbleEmoji === 'nervous' && now - lastNervousAtRef.current > BUBBLE_NERVOUS_MS) {
        setBubbleEmoji(null);
        setBubbleChar('');
        return;
      }
      if (Math.random() < BUBBLE_NERVOUS_CHANCE && now - lastNervousAtRef.current > BUBBLE_NERVOUS_COOLDOWN_MS) {
        lastNervousAtRef.current = now;
        const picked = pickThoughtEmoji(EMOTIONS_NERVOUS, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        setBubbleEmoji('nervous');
        setBubbleChar(picked);
        return;
      }
      if (lastSkiingAtRef.current === 0 || now - lastSkiingAtRef.current >= BUBBLE_SKIING_MIN_MS) {
        const picked = pickThoughtEmoji(EMOTIONS_SKIING, lastBubbleCharRef.current);
        lastBubbleCharRef.current = picked;
        lastSkiingAtRef.current = now;
        setBubbleEmoji('skiing');
        setBubbleChar(picked);
        return;
      }
      return;
    }, 280);
    return () => clearInterval(id);
  }, [bubbleEmoji]);

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
          const worldY =
            scrollNow - SCREEN_HEIGHT - 320 + Math.random() * 200;
          const roll = Math.random() * 100;
          if (roll < SPAWN_CHANCE_OBSTACLE) {
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
            const itemId = pickByWeight(GOOD_ITEMS).id;
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

      // Çarpışma: engeller görsel dikdörtgenle (taş/ağaç aynı), emoji spawn merkeziyle
      if (!disabled) {
        const ghost = now < ghostUntilRef.current;
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

          if (s.kind === 'obstacle') {
            const obs = getObstacleById(s.itemId as string);
            if (obs?.description) setPopupMessage(obs.description);
            if (!ghost) {
              slideEndTimeRef.current = now; // Taş veya ağaç: oyun biter, süre durur
              setState('clumsy');
            }
            const next = spawnsRef.current.filter(x => x.id !== s.id);
            spawnsRef.current = next;
            setSpawns(next);
            break;
          }
          if (s.kind === 'good') {
            const def = GOOD_ITEMS.find(g => g.id === s.itemId);
            if (def) {
              setPopupMessage(def.description);
              if (def.points) setScore(prev => prev + def.points);
              if (def.effect === 'ghost') ghostUntilRef.current = now + def.durationMs;
              if (def.effect === 'super_speed') superSpeedUntilRef.current = now + def.durationMs;
              if (def.effect === 'speed_boost') {
                const add = SPEED_BOOST_ADD;
                setSpeed(prev => Math.min(MAX_SPEED, prev + add));
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

  const handleCenterPress = useCallback(() => {
    hasCenterPressed.current = true;
    setState('stand');
    const r = tapRateRef.current;
    const add = r >= 7 ? 5 : r >= 4 ? 2 : 1; // yeşil +1, sarı +2, kırmızı +5
    setSpeed(s => Math.min(MAX_SPEED, s + add));
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
    worldPanXRef.current = 0;
    worldPanXAnim.setValue(0);
  }, []);

  const isDisabled = state === 'clumsy' || state === 'fall-florr';

  // Kar dokusu: satır bazlı hafif ton farkı + dash kalınlığı/opaklık varyasyonu
  const getDashStyle = (rowIndex: number, dashIndex: number) => {
    const baseTop = (rowIndex * SEGMENT_HEIGHT) / 12;
    const wave = Math.sin(dashIndex * 0.45) * WAVE_AMP + Math.sin(rowIndex * 0.7) * 2;
    const rowParity = rowIndex % 3;
    const opacity = 0.08 + (rowParity === 0 ? 0.06 : rowParity === 1 ? 0.04 : 0.07);
    const height = rowParity === 2 ? 2 : 1;
    const left = dashIndex * (DASH_WIDTH + DASH_GAP);
    const top = baseTop + wave;
    return { left, top, opacity, height };
  };

  const renderSegment = (keyPrefix: string) => (
    <View style={styles.segment}>
      {/* Alt katman: hafif kar gölgesi çizgileri */}
      {Array.from({length: 12}).map((_, rowIndex) =>
        Array.from({length: DASHES_PER_ROW}).map((_, dashIndex) => {
          const { left, top, opacity, height } = getDashStyle(rowIndex, dashIndex);
          return (
            <View
              key={`${keyPrefix}-${rowIndex}-${dashIndex}`}
              style={[
                styles.stripeDash,
                {
                  left,
                  top,
                  backgroundColor: `rgba(100, 120, 140, ${opacity})`,
                  height,
                },
              ]}
            />
          );
        }),
      )}
      {/* Üst katman: kayak izi benzeri daha belirgin çizgiler (seyrek) */}
      {Array.from({length: 12}).map((_, rowIndex) =>
        (rowIndex % 2 === 0 ? [0, 2, 4] : [1, 3]).map(offset => {
          const dashIndex = Math.min(offset * Math.floor(DASHES_PER_ROW / 5), DASHES_PER_ROW - 1);
          const { left, top } = getDashStyle(rowIndex, dashIndex);
          return (
            <View
              key={`${keyPrefix}-ridge-${rowIndex}-${dashIndex}`}
              style={[
                styles.stripeDash,
                styles.snowRidge,
                { left, top },
              ]}
            />
          );
        }),
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#e8eef4" />

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

      {/* Popup: item/engel açıklaması (şeffaf balon) */}
      {popupMessage ? (
        <View style={styles.popupWrap}>
          <View style={styles.popupBalloon}>
            <Text style={styles.popupText}>{popupMessage}</Text>
          </View>
        </View>
      ) : null}

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
              style={state === 'right-ski' ? styles.skierSmall : styles.skier}
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
  segment: {
    height: SEGMENT_HEIGHT,
    backgroundColor: '#ecf0f6',
  },
  segmentCopy: {
    height: SEGMENT_HEIGHT,
  },
  stripeDash: {
    position: 'absolute',
    width: DASH_WIDTH,
    height: 1,
  },
  snowRidge: {
    height: 2,
    backgroundColor: 'rgba(120, 140, 160, 0.18)',
    width: DASH_WIDTH + 4,
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
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
