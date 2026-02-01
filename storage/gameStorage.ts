/**
 * Kalıcı depolama – toplam puan ve yükseltmeler.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  STORAGE_KEYS,
  DEFAULT_UPGRADES,
  MAX_SPEED_LEVEL,
  MAX_JUMP_DURATION_LEVEL,
  MAX_GOOD_SPAWN_LEVEL,
  MAX_BAD_SPAWN_LEVEL,
  type UpgradesState,
} from '../constants/upgrades';

/** Serbest kay kişisel rekoru: gidilen mesafe (metre) */
export async function getFreeSkiRecord(): Promise<number> {
  try {
    const s = await AsyncStorage.getItem(STORAGE_KEYS.FREE_SKI_RECORD);
    if (s == null) return 0;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  } catch {
    return 0;
  }
}

export async function setFreeSkiRecord(value: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.FREE_SKI_RECORD, String(Math.max(0, value)));
}

/** Serbest kay bitince mesafe (m) rekoru geçerse günceller, yeni rekoru döndürür */
export async function updateFreeSkiRecordIfBetter(distanceMeters: number): Promise<number> {
  if (distanceMeters <= 0) return await getFreeSkiRecord();
  const current = await getFreeSkiRecord();
  if (distanceMeters <= current) return current;
  await setFreeSkiRecord(distanceMeters);
  return distanceMeters;
}

export async function getTotalPoints(): Promise<number> {
  try {
    const s = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_POINTS);
    if (s == null) return 0;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  } catch {
    return 0;
  }
}

export async function setTotalPoints(value: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_POINTS, String(Math.max(0, value)));
}

export async function addPoints(amount: number): Promise<number> {
  const current = await getTotalPoints();
  const next = Math.max(0, current + amount);
  await setTotalPoints(next);
  return next;
}

export async function getTotalEarned(): Promise<number> {
  try {
    const s = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_EARNED);
    if (s == null) return 0;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  } catch {
    return 0;
  }
}

export async function setTotalEarned(value: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_EARNED, String(Math.max(0, value)));
}

/** Oyun bitince kazanılan puanı hem bakiyeye hem toplam kazanca ekler */
export async function addEarnedFromRun(score: number): Promise<{ balance: number; totalEarned: number }> {
  if (score <= 0) {
    const balance = await getTotalPoints();
    const totalEarned = await getTotalEarned();
    return { balance, totalEarned };
  }
  const [balance, totalEarned] = await Promise.all([getTotalPoints(), getTotalEarned()]);
  const newBalance = Math.max(0, balance + score);
  const newTotalEarned = totalEarned + score;
  await Promise.all([setTotalPoints(newBalance), setTotalEarned(newTotalEarned)]);
  return { balance: newBalance, totalEarned: newTotalEarned };
}

export async function getUpgrades(): Promise<UpgradesState> {
  try {
    const s = await AsyncStorage.getItem(STORAGE_KEYS.UPGRADES);
    if (s == null) return DEFAULT_UPGRADES;
    const parsed = JSON.parse(s) as Partial<UpgradesState>;
    return {
      speedLevel: Math.max(0, Math.min(parsed.speedLevel ?? 0, MAX_SPEED_LEVEL)),
      jumpDurationLevel: Math.max(0, Math.min(parsed.jumpDurationLevel ?? 0, MAX_JUMP_DURATION_LEVEL)),
      rocketStored: Math.max(0, parsed.rocketStored ?? 0),
      extraLivesStored: Math.max(0, parsed.extraLivesStored ?? 0),
      goodSpawnLevel: Math.max(0, Math.min(parsed.goodSpawnLevel ?? 0, MAX_GOOD_SPAWN_LEVEL)),
      badSpawnLevel: Math.max(0, Math.min(parsed.badSpawnLevel ?? 0, MAX_BAD_SPAWN_LEVEL)),
    };
  } catch {
    return DEFAULT_UPGRADES;
  }
}

export async function setUpgrades(upgrades: UpgradesState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.UPGRADES, JSON.stringify(upgrades));
}

export { setPendingGhostSeconds } from './pendingGhost';
