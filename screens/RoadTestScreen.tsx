/**
 * Road test – oyun gibi: karakter 5 km/h ile başlar, sen hızlandırırsın.
 * Sahne kendi ilerlemez; sen ilerledikçe hızın kadar sahne gelir. Sağ/sol efektler düzeltildi.
 */

import React, { useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Pressable,
  Text,
  StatusBar,
} from 'react-native';
import GamePad from '../components/GamePad';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FLAT_IMAGE = require('../assets/road/flat.jpg');
const STAND_SKI_IMAGE = require('../assets/skyguy/stand-ski.png');
const LEFT_SKI_IMAGE = require('../assets/skyguy/left-ski.png');
const RIGHT_SKI_IMAGE = require('../assets/skyguy/right-ski.png');
const JUMP_IMAGE = require('../assets/skyguy/jump.png');
const CLUMSY_IMAGE = require('../assets/skyguy/clumsy.png');
const FALL_IMAGE = require('../assets/skyguy/fall-florr.png');

const ROAD_IMAGE_WIDTH = 896;
const ROAD_IMAGE_HEIGHT = 1200;
const TILE_HEIGHT = ROAD_IMAGE_HEIGHT;
const ABOVE_TILES = 5;
const NUM_TILES = 12;
const INITIAL_OFFSET_PX = ABOVE_TILES * TILE_HEIGHT;
const MOVE_SPEED_PX_PER_MS = 0.45;

const ROAD_LEFT_WORLD = ROAD_IMAGE_WIDTH / 3;
const ROAD_RIGHT_WORLD = (ROAD_IMAGE_WIDTH * 2) / 3;
const ROAD_CENTER_WORLD = ROAD_IMAGE_WIDTH / 2;
const ROAD_HALF_WIDTH_PX = ROAD_IMAGE_WIDTH / 6;
const MAX_OFFSET_PX = ROAD_HALF_WIDTH_PX;
const CAMERA_EASE = 0.06;
const BOUNDARY_SPEED_FACTOR = 0.4;

const TILT_RAMP_MS = 260;
const ACCEL_RAMP_MS = 260;
const ACCEL_ADD_INTERVAL_MS = 120;
const JUMP_DURATION_MS = 600;
const CLUMSY_DURATION_MS = 400;

const MIN_SPEED_KMH = 5;
const MAX_SPEED_KMH = 80;
const SCROLL_FACTOR = 0.18;

type SkierState = 'stand-ski' | 'left-ski' | 'right-ski' | 'jump' | 'clumsy' | 'fall-florr';

type Props = {
  onBack: () => void;
};

function RoadTestScreen({ onBack }: Props): React.JSX.Element {
  const translateY = useRef(new Animated.Value(-INITIAL_OFFSET_PX)).current;
  const [tiles, setTiles] = useState(() => Array(NUM_TILES).fill(FLAT_IMAGE));
  const totalHeight = NUM_TILES * TILE_HEIGHT;

  const [speed, setSpeed] = useState(MIN_SPEED_KMH);
  const speedRef = useRef(MIN_SPEED_KMH);
  const scrollOffsetRef = useRef(0);
  const lastAccelAddRef = useRef(0);

  const skierOffsetXRef = useRef(0);
  const skierOffsetXAnim = useRef(new Animated.Value(0)).current;
  const panXRef = useRef(0);
  const panXAnim = useRef(new Animated.Value(0)).current;
  const charXAnim = useRef(new Animated.Value(0)).current;
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

  speedRef.current = speed;

  useLayoutEffect(() => {
    translateY.setValue(-INITIAL_OFFSET_PX);
    scrollOffsetRef.current = 0;
    const startPan = Math.max(0, Math.min(ROAD_IMAGE_WIDTH - SCREEN_WIDTH, ROAD_CENTER_WORLD - SCREEN_WIDTH / 2));
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
      const leftHeld = leftPressedAtRef.current > 0;
      const rightHeld = rightPressedAtRef.current > 0;
      const canMove = state === 'stand-ski' || state === 'left-ski' || state === 'right-ski';
      const worldPaused = state === 'clumsy' || state === 'fall-florr';

      if (canMove) {
        if (leftHeld) {
          const elapsed = now - leftPressedAtRef.current;
          leftTiltRef.current = Math.min(1, elapsed / TILT_RAMP_MS);
          rightTiltRef.current = 0;
          skierOffsetXRef.current = Math.max(-MAX_OFFSET_PX, skierOffsetXRef.current - MOVE_SPEED_PX_PER_MS * dt);
        } else if (rightHeld) {
          const elapsed = now - rightPressedAtRef.current;
          rightTiltRef.current = Math.min(1, elapsed / TILT_RAMP_MS);
          leftTiltRef.current = 0;
          skierOffsetXRef.current = Math.min(MAX_OFFSET_PX, skierOffsetXRef.current + MOVE_SPEED_PX_PER_MS * dt);
        } else {
          leftTiltRef.current = 0;
          rightTiltRef.current = 0;
        }
      }
      skierOffsetXRef.current = Math.max(-MAX_OFFSET_PX, Math.min(MAX_OFFSET_PX, skierOffsetXRef.current));
      skierOffsetXAnim.setValue(skierOffsetXRef.current);

      const targetPanX = ROAD_CENTER_WORLD + skierOffsetXRef.current - SCREEN_WIDTH / 2;
      const minPan = 0;
      const maxPan = Math.max(0, ROAD_IMAGE_WIDTH - SCREEN_WIDTH);
      const clampedPan = Math.max(minPan, Math.min(maxPan, targetPanX));
      panXRef.current += (clampedPan - panXRef.current) * CAMERA_EASE;
      panXAnim.setValue(-panXRef.current);
      charXAnim.setValue(-panXRef.current + skierOffsetXRef.current + ROAD_CENTER_WORLD - SCREEN_WIDTH / 2);

      if (!worldPaused && speedRef.current > 0) {
        const boundaryRatio = Math.abs(skierOffsetXRef.current) / MAX_OFFSET_PX;
        const speedMult = 1 - boundaryRatio * BOUNDARY_SPEED_FACTOR;
        const effectiveSpeed = Math.max(MIN_SPEED_KMH * 0.3, speedRef.current * speedMult);
        const delta = effectiveSpeed * SCROLL_FACTOR * (dt / 16);
        scrollOffsetRef.current += delta;
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
    if (jumpEndRef.current) clearTimeout(jumpEndRef.current);
    setState('jump');
    jumpEndRef.current = setTimeout(() => {
      jumpEndRef.current = null;
      setState('stand-ski');
    }, JUMP_DURATION_MS);
  }, [state]);

  const handleJumpRelease = useCallback(() => {}, []);

  const handleAccelRelease = useCallback(() => {
    const at = accelPressedAtRef.current;
    accelPressedAtRef.current = 0;
    setAccelHold(0);
    if (at > 0 && Date.now() - at > 1500 && (state === 'stand-ski' || state === 'left-ski' || state === 'right-ski')) {
      if (clumsyEndRef.current) clearTimeout(clumsyEndRef.current);
      setState('clumsy');
      clumsyEndRef.current = setTimeout(() => {
        clumsyEndRef.current = null;
        setState('fall-florr');
        setTimeout(() => setState('stand-ski'), 2000);
      }, CLUMSY_DURATION_MS);
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (jumpEndRef.current) clearTimeout(jumpEndRef.current);
      if (clumsyEndRef.current) clearTimeout(clumsyEndRef.current);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setLeftTiltDisplay(leftTiltRef.current);
      setRightTiltDisplay(rightTiltRef.current);
    }, 120);
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
    : STAND_SKI_IMAGE;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.roadWrap} pointerEvents="none">
        <Animated.View
          style={[
            styles.roadStrip,
            {
              width: ROAD_IMAGE_WIDTH,
              height: totalHeight,
              transform: [{ translateX: panXAnim }, { translateY }],
            },
          ]}>
          {tiles.map((src, i) => (
            <Image
              key={`tile-${i}`}
              source={src}
              style={[styles.tile, { top: i * TILE_HEIGHT, width: ROAD_IMAGE_WIDTH, height: TILE_HEIGHT }]}
              resizeMode="stretch"
            />
          ))}
        </Animated.View>
      </View>
      <View style={styles.skierPlaceholder} pointerEvents="none">
        <Animated.View
          style={[
            styles.skierWrap,
            {
              left: SCREEN_WIDTH / 2 - 30,
              transform: [{ translateX: charXAnim }],
            },
          ]}>
          <Image source={skierSource} style={styles.skierImage} resizeMode="contain" />
        </Animated.View>
      </View>
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
        onAccel={() => { accelPressedAtRef.current = Date.now(); }}
        onAccelRelease={handleAccelRelease}
        onJumpPress={handleJumpPress}
        onJumpRelease={handleJumpRelease}
        leftTilt={leftTiltDisplay}
        rightTilt={rightTiltDisplay}
        accelTilt={accelHold}
        disabled={false}
      />
      <View style={styles.speedBadge}>
        <Text style={styles.speedBadgeText}>{speed.toFixed(0)} km/h</Text>
      </View>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Geri</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
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
  speedBadge: {
    position: 'absolute',
    top: 48,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 10,
  },
  speedBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RoadTestScreen;
