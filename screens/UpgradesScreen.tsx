/**
 * Yükseltmeler – puan ile kalıcı ve oyun başı satın almalar.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import {
  getSpeedUpgradeCost,
  getMaxSpeedFromLevel,
  MAX_SPEED_LEVEL,
  GHOST_START_COST,
  GHOST_START_SECONDS,
  getJumpDurationMs,
  getJumpDurationCost,
  MAX_JUMP_DURATION_LEVEL,
  ROCKET_COST,
  ROCKET_DURATION_MS,
  EXTRA_LIFE_COST,
  type UpgradesState,
} from '../constants/upgrades';
import {
  setTotalPoints,
  addPoints,
  getUpgrades,
  setUpgrades,
} from '../storage/gameStorage';
import { setPendingGhostSeconds } from '../storage/pendingGhost';
import { useI18n } from '../i18n';

type Props = {
  totalPoints: number;
  totalEarned: number;
  level: number;
  upgrades: UpgradesState;
  onClose: () => void;
  onPurchase: () => void;
};

function UpgradesScreen({
  totalPoints,
  totalEarned,
  level,
  upgrades,
  onClose,
  onPurchase,
}: Props): React.JSX.Element {
  const { t } = useI18n();
  const speedLevel = upgrades.speedLevel;
  const speedCost = getSpeedUpgradeCost(speedLevel);
  const canBuySpeed = speedLevel < MAX_SPEED_LEVEL && totalPoints >= speedCost;
  const jumpLevel = upgrades.jumpDurationLevel;
  const jumpCost = getJumpDurationCost(jumpLevel);
  const canBuyJump = jumpLevel < MAX_JUMP_DURATION_LEVEL && totalPoints >= jumpCost;
  const canBuyRocket = totalPoints >= ROCKET_COST;
  const canBuyExtraLife = totalPoints >= EXTRA_LIFE_COST;

  const handleBuySpeed = async () => {
    if (!canBuySpeed) return;
    await setTotalPoints(totalPoints - speedCost);
    const current = await getUpgrades();
    await setUpgrades({ ...current, speedLevel: current.speedLevel + 1 });
    onPurchase();
  };

  const handleBuyGhost = async () => {
    if (totalPoints < GHOST_START_COST) return;
    await addPoints(-GHOST_START_COST);
    setPendingGhostSeconds(GHOST_START_SECONDS);
    onPurchase();
  };

  const handleBuyJumpDuration = async () => {
    if (!canBuyJump) return;
    await setTotalPoints(totalPoints - jumpCost);
    const current = await getUpgrades();
    await setUpgrades({ ...current, jumpDurationLevel: current.jumpDurationLevel + 1 });
    onPurchase();
  };

  const handleBuyRocket = async () => {
    if (totalPoints < ROCKET_COST) return;
    await setTotalPoints(totalPoints - ROCKET_COST);
    const current = await getUpgrades();
    await setUpgrades({ ...current, rocketStored: (current.rocketStored ?? 0) + 1 });
    onPurchase();
  };

  const handleBuyExtraLife = async () => {
    if (totalPoints < EXTRA_LIFE_COST) return;
    await setTotalPoints(totalPoints - EXTRA_LIFE_COST);
    const current = await getUpgrades();
    await setUpgrades({ ...current, extraLivesStored: (current.extraLivesStored ?? 0) + 1 });
    onPurchase();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <Text style={styles.title}>{t('upgrades_title')}</Text>
        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>{t('upgrades_yourPoints')}</Text>
          <Text style={styles.pointsValue}>⭐ {totalPoints}</Text>
        </View>
        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>Lv.{level} · {t('entry_totalEarned')}</Text>
          <Text style={styles.pointsValue}>{totalEarned}</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeButtonText}>{t('upgrades_close')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚡ {t('upgrades_maxSpeed')}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_maxSpeedDesc')}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardStat}>
              {t('upgrades_level')} {speedLevel}/{MAX_SPEED_LEVEL} → {getMaxSpeedFromLevel(speedLevel)} km
            </Text>
            {speedLevel < MAX_SPEED_LEVEL ? (
              <TouchableOpacity
                style={[styles.buyButton, !canBuySpeed && styles.buyButtonDisabled]}
                onPress={handleBuySpeed}
                disabled={!canBuySpeed}
                activeOpacity={0.8}>
                <Text style={styles.buyButtonText}>
                  +10 km — ⭐ {speedCost}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.maxedText}>{t('upgrades_maxed')}</Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🦘 {t('upgrades_jumpDuration')}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_jumpDurationDesc')}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardStat}>
              {t('upgrades_level')} {jumpLevel}/{MAX_JUMP_DURATION_LEVEL} → {getJumpDurationMs(jumpLevel)} ms
            </Text>
            {jumpLevel < MAX_JUMP_DURATION_LEVEL ? (
              <TouchableOpacity
                style={[styles.buyButton, !canBuyJump && styles.buyButtonDisabled]}
                onPress={handleBuyJumpDuration}
                disabled={!canBuyJump}
                activeOpacity={0.8}>
                <Text style={styles.buyButtonText}>+200 ms — ⭐ {jumpCost}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.maxedText}>{t('upgrades_maxed')}</Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚀 {t('upgrades_rocket')}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_rocketDesc')}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardStat}>Envanter: {upgrades.rocketStored ?? 0}</Text>
            <TouchableOpacity
              style={[styles.buyButton, !canBuyRocket && styles.buyButtonDisabled]}
              onPress={handleBuyRocket}
              disabled={!canBuyRocket}
              activeOpacity={0.8}>
              <Text style={styles.buyButtonText}>
                {t('upgrades_buy')} — ⭐ {ROCKET_COST}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>👻 {t('upgrades_ghostMode')}</Text>
          <Text style={styles.cardDesc}>
            {t('upgrades_ghostModeDesc', { seconds: GHOST_START_SECONDS })}
          </Text>
          <TouchableOpacity
            style={[
              styles.buyButton,
              totalPoints < GHOST_START_COST && styles.buyButtonDisabled,
            ]}
            onPress={handleBuyGhost}
            disabled={totalPoints < GHOST_START_COST}
            activeOpacity={0.8}>
            <Text style={styles.buyButtonText}>
              {t('upgrades_buy')} — ⭐ {GHOST_START_COST}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛡️ {t('upgrades_extraLife')}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_extraLifeDesc')}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardStat}>{t('upgrades_extraLifeCount')}: {upgrades.extraLivesStored ?? 0}</Text>
            <TouchableOpacity
              style={[styles.buyButton, !canBuyExtraLife && styles.buyButtonDisabled]}
              onPress={handleBuyExtraLife}
              disabled={!canBuyExtraLife}
              activeOpacity={0.8}>
              <Text style={styles.buyButtonText}>
                {t('upgrades_buy')} — ⭐ {EXTRA_LIFE_COST}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 116, 139, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pointsLabel: {
    fontSize: 16,
    color: '#94a3b8',
  },
  pointsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fbbf24',
  },
  closeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(100, 116, 139, 0.4)',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  cardMuted: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
    opacity: 0.8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardStat: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  buyButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  buyButtonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.7,
  },
  buyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  maxedText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
});

export default UpgradesScreen;
