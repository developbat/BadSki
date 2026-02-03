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
  getGoodSpawnUpgradeCost,
  getBadSpawnUpgradeCost,
  MAX_GOOD_SPAWN_LEVEL,
  MAX_BAD_SPAWN_LEVEL,
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
import {
  showRewardedWhenReady,
  showInterstitialWhenReady,
  REWARDED_POINTS,
} from '../services/adMob';

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
  const goodSpawnLevel = upgrades.goodSpawnLevel ?? 0;
  const badSpawnLevel = upgrades.badSpawnLevel ?? 0;
  const goodSpawnCost = getGoodSpawnUpgradeCost(goodSpawnLevel);
  const badSpawnCost = getBadSpawnUpgradeCost(badSpawnLevel);
  const canBuyGoodSpawn = goodSpawnLevel < MAX_GOOD_SPAWN_LEVEL && totalPoints >= goodSpawnCost;
  const canBuyBadSpawn = badSpawnLevel < MAX_BAD_SPAWN_LEVEL && totalPoints >= badSpawnCost;

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

  const handleWatchAdForPoints = () => {
    showRewardedWhenReady(async (points) => {
      await addPoints(points);
      onPurchase();
    });
  };

  const unlockSpeedViaAd = () => {
    showInterstitialWhenReady(async () => {
      const current = await getUpgrades();
      if (current.speedLevel < MAX_SPEED_LEVEL) {
        await setUpgrades({ ...current, speedLevel: current.speedLevel + 1 });
        onPurchase();
      }
    });
  };
  const unlockJumpViaAd = () => {
    showInterstitialWhenReady(async () => {
      const current = await getUpgrades();
      if (current.jumpDurationLevel < MAX_JUMP_DURATION_LEVEL) {
        await setUpgrades({ ...current, jumpDurationLevel: current.jumpDurationLevel + 1 });
        onPurchase();
      }
    });
  };
  const unlockRocketViaAd = () => {
    showInterstitialWhenReady(async () => {
      const current = await getUpgrades();
      await setUpgrades({ ...current, rocketStored: (current.rocketStored ?? 0) + 1 });
      onPurchase();
    });
  };
  const unlockGhostViaAd = () => {
    showInterstitialWhenReady(() => {
      setPendingGhostSeconds(GHOST_START_SECONDS);
      onPurchase();
    });
  };
  const unlockExtraLifeViaAd = () => {
    showInterstitialWhenReady(async () => {
      const current = await getUpgrades();
      await setUpgrades({ ...current, extraLivesStored: (current.extraLivesStored ?? 0) + 1 });
      onPurchase();
    });
  };

  const handleBuyGoodSpawn = async () => {
    if (!canBuyGoodSpawn) return;
    await setTotalPoints(totalPoints - goodSpawnCost);
    const current = await getUpgrades();
    await setUpgrades({ ...current, goodSpawnLevel: (current.goodSpawnLevel ?? 0) + 1 });
    onPurchase();
  };

  const handleBuyBadSpawn = async () => {
    if (!canBuyBadSpawn) return;
    await setTotalPoints(totalPoints - badSpawnCost);
    const current = await getUpgrades();
    await setUpgrades({ ...current, badSpawnLevel: (current.badSpawnLevel ?? 0) + 1 });
    onPurchase();
  };

  const unlockGoodSpawnViaAd = () => {
    showInterstitialWhenReady(async () => {
      const current = await getUpgrades();
      if ((current.goodSpawnLevel ?? 0) < MAX_GOOD_SPAWN_LEVEL) {
        await setUpgrades({ ...current, goodSpawnLevel: (current.goodSpawnLevel ?? 0) + 1 });
        onPurchase();
      }
    });
  };

  const unlockBadSpawnViaAd = () => {
    showInterstitialWhenReady(async () => {
      const current = await getUpgrades();
      if ((current.badSpawnLevel ?? 0) < MAX_BAD_SPAWN_LEVEL) {
        await setUpgrades({ ...current, badSpawnLevel: (current.badSpawnLevel ?? 0) + 1 });
        onPurchase();
      }
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <Text style={styles.title}>{t('upgrades_title')}</Text>
        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>{t('upgrades_yourPoints')}</Text>
          <Text style={styles.pointsValue}>{t('upgrades_pointsDisplay', { points: totalPoints })}</Text>
        </View>
        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>{t('upgrades_levelEarned', { level, count: totalEarned })} {t('entry_totalEarned')}</Text>
          <Text style={styles.pointsValue}>{totalEarned}</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeButtonText}>{t('upgrades_close')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⭐ {t('upgrades_pointsProductTitle', { points: REWARDED_POINTS })}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_pointsProductDesc')}</Text>
          <TouchableOpacity
            style={styles.buyButton}
            onPress={handleWatchAdForPoints}
            activeOpacity={0.8}>
            <Text style={styles.buyButtonText}>🎬 {t('upgrades_watchAdForPoints')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚡ {t('upgrades_maxSpeed')}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_maxSpeedDesc')}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardStat}>
              {t('upgrades_level')} {speedLevel}/{MAX_SPEED_LEVEL} → {getMaxSpeedFromLevel(speedLevel)} {t('game_kmUnit')}
            </Text>
            {speedLevel < MAX_SPEED_LEVEL ? (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.buyButton, !canBuySpeed && styles.buyButtonDisabled]}
                  onPress={handleBuySpeed}
                  disabled={!canBuySpeed}
                  activeOpacity={0.8}>
                  <Text style={styles.buyButtonText}>
                    {t('upgrades_speedCostFormat', { cost: speedCost })}
                  </Text>
                </TouchableOpacity>
                {!canBuySpeed && (
                  <TouchableOpacity
                    style={styles.unlockAdButton}
                    onPress={unlockSpeedViaAd}
                    activeOpacity={0.8}>
                    <Text style={styles.unlockAdButtonText}>🎬 {t('upgrades_watchAdToUnlock')}</Text>
                  </TouchableOpacity>
                )}
              </View>
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
              {t('upgrades_jumpStatFormat', { level: jumpLevel, max: MAX_JUMP_DURATION_LEVEL, ms: getJumpDurationMs(jumpLevel) })}
            </Text>
            {jumpLevel < MAX_JUMP_DURATION_LEVEL ? (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.buyButton, !canBuyJump && styles.buyButtonDisabled]}
                  onPress={handleBuyJumpDuration}
                  disabled={!canBuyJump}
                  activeOpacity={0.8}>
                  <Text style={styles.buyButtonText}>{t('upgrades_jumpCostFormat', { cost: jumpCost })}</Text>
                </TouchableOpacity>
                {!canBuyJump && (
                  <TouchableOpacity
                    style={styles.unlockAdButton}
                    onPress={unlockJumpViaAd}
                    activeOpacity={0.8}>
                    <Text style={styles.unlockAdButtonText}>🎬 {t('upgrades_watchAdToUnlock')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={styles.maxedText}>{t('upgrades_maxed')}</Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚀 {t('upgrades_rocket')}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_rocketDesc')}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardStat}>{t('upgrades_inventoryCount', { count: upgrades.rocketStored ?? 0 })}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.buyButton, !canBuyRocket && styles.buyButtonDisabled]}
                onPress={handleBuyRocket}
                disabled={!canBuyRocket}
                activeOpacity={0.8}>
<Text style={styles.buyButtonText}>
                {t('upgrades_buyCostFormat', { buy: t('upgrades_buy'), cost: ROCKET_COST })}
              </Text>
              </TouchableOpacity>
              {!canBuyRocket && (
                <TouchableOpacity
                  style={styles.unlockAdButton}
                  onPress={unlockRocketViaAd}
                  activeOpacity={0.8}>
                  <Text style={styles.unlockAdButtonText}>🎬 {t('upgrades_watchAdToUnlock')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>👻 {t('upgrades_ghostMode')}</Text>
          <Text style={styles.cardDesc}>
            {t('upgrades_ghostModeDesc', { seconds: GHOST_START_SECONDS })}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[
                styles.buyButton,
                totalPoints < GHOST_START_COST && styles.buyButtonDisabled,
              ]}
              onPress={handleBuyGhost}
              disabled={totalPoints < GHOST_START_COST}
              activeOpacity={0.8}>
<Text style={styles.buyButtonText}>
              {t('upgrades_buyCostFormat', { buy: t('upgrades_buy'), cost: GHOST_START_COST })}
              </Text>
            </TouchableOpacity>
            {totalPoints < GHOST_START_COST && (
              <TouchableOpacity
                style={styles.unlockAdButton}
                onPress={unlockGhostViaAd}
                activeOpacity={0.8}>
                <Text style={styles.unlockAdButtonText}>🎬 {t('upgrades_watchAdToUnlock')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛡️ {t('upgrades_extraLife')}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_extraLifeDesc')}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardStat}>{t('upgrades_extraLifeStatFormat', { label: t('upgrades_extraLifeCount'), count: upgrades.extraLivesStored ?? 0 })}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.buyButton, !canBuyExtraLife && styles.buyButtonDisabled]}
                onPress={handleBuyExtraLife}
                disabled={!canBuyExtraLife}
                activeOpacity={0.8}>
<Text style={styles.buyButtonText}>
                {t('upgrades_buyCostFormat', { buy: t('upgrades_buy'), cost: EXTRA_LIFE_COST })}
                </Text>
              </TouchableOpacity>
              {!canBuyExtraLife && (
                <TouchableOpacity
                  style={styles.unlockAdButton}
                  onPress={unlockExtraLifeViaAd}
                  activeOpacity={0.8}>
                  <Text style={styles.unlockAdButtonText}>🎬 {t('upgrades_watchAdToUnlock')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⭐ {t('upgrades_goodSpawnTitle')}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_goodSpawnDesc')}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardStat}>
              {t('upgrades_goodSpawnStatFormat', { level: goodSpawnLevel, max: MAX_GOOD_SPAWN_LEVEL, percent: goodSpawnLevel * 2, good: t('common_good') })}
            </Text>
            {goodSpawnLevel < MAX_GOOD_SPAWN_LEVEL ? (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.buyButton, !canBuyGoodSpawn && styles.buyButtonDisabled]}
                  onPress={handleBuyGoodSpawn}
                  disabled={!canBuyGoodSpawn}
                  activeOpacity={0.8}>
                  <Text style={styles.buyButtonText}>{t('upgrades_goodSpawnCostFormat', { cost: goodSpawnCost })}</Text>
                </TouchableOpacity>
                {!canBuyGoodSpawn && (
                  <TouchableOpacity
                    style={styles.unlockAdButton}
                    onPress={unlockGoodSpawnViaAd}
                    activeOpacity={0.8}>
                    <Text style={styles.unlockAdButtonText}>🎬 {t('upgrades_watchAdToUnlock')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={styles.maxedText}>{t('upgrades_maxed')}</Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🍋 {t('upgrades_badSpawnTitle')}</Text>
          <Text style={styles.cardDesc}>{t('upgrades_badSpawnDesc')}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardStat}>
              {t('upgrades_level')} {badSpawnLevel}/{MAX_BAD_SPAWN_LEVEL} → -{badSpawnLevel * 2}% kötü
            </Text>
            {badSpawnLevel < MAX_BAD_SPAWN_LEVEL ? (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.buyButton, !canBuyBadSpawn && styles.buyButtonDisabled]}
                  onPress={handleBuyBadSpawn}
                  disabled={!canBuyBadSpawn}
                  activeOpacity={0.8}>
                  <Text style={styles.buyButtonText}>-2% — ⭐ {badSpawnCost}</Text>
                </TouchableOpacity>
                {!canBuyBadSpawn && (
                  <TouchableOpacity
                    style={styles.unlockAdButton}
                    onPress={unlockBadSpawnViaAd}
                    activeOpacity={0.8}>
                    <Text style={styles.unlockAdButtonText}>🎬 {t('upgrades_watchAdToUnlock')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={styles.maxedText}>{t('upgrades_maxed')}</Text>
            )}
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  unlockAdButton: {
    backgroundColor: 'rgba(100, 116, 139, 0.5)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  unlockAdButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
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
