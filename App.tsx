/**
 * Badski - Yokuş aşağı kayak oyunu
 * Giriş: Puan, Yükseltmeler, Görev getir / Serbest kay
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native';
import { I18nProvider } from './i18n';
import EntryScreen from './screens/EntryScreen';
import UpgradesScreen from './screens/UpgradesScreen';
import RoadTestScreen from './screens/RoadTestScreen';
import type { Mission } from './constants/missions';
import type { UpgradesState } from './constants/upgrades';
import { getMaxSpeedFromLevel, getJumpDurationMs, getLevelFromTotalEarned, DEFAULT_UPGRADES } from './constants/upgrades';
import {
  getTotalPoints,
  getTotalEarned,
  addEarnedFromRun,
  getFreeSkiRecord,
  updateFreeSkiRecordIfBetter,
  getUpgrades,
  setUpgrades,
} from './storage/gameStorage';
import { consumePendingGhost } from './storage/pendingGhost';
import { initAdMob, loadInterstitial, loadRewarded, showInterstitialWhenReady } from './services/adMob';

type Screen = 'entry' | 'game' | 'upgrades' | 'roadTest';

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('entry');
  const [mission, setMission] = useState<Mission | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [freeSkiRecord, setFreeSkiRecord] = useState(0);
  const [upgrades, setUpgradesState] = useState<UpgradesState>(DEFAULT_UPGRADES);

  const loadStorage = useCallback(async () => {
    const [points, earned, record, up] = await Promise.all([
      getTotalPoints(),
      getTotalEarned(),
      getFreeSkiRecord(),
      getUpgrades(),
    ]);
    setTotalPoints(points);
    setTotalEarned(earned);
    setFreeSkiRecord(record);
    setUpgradesState(up);
  }, []);

  useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  useEffect(() => {
    initAdMob().then(() => {
      loadInterstitial();
      loadRewarded();
    });
  }, []);

  const [startWithGhostSeconds, setStartWithGhostSeconds] = useState(0);

  const handleStartGame = (m: Mission | null) => {
    setMission(m);
    setStartWithGhostSeconds(consumePendingGhost());
    setScreen('game');
  };

  const level = getLevelFromTotalEarned(totalEarned);
  const initialMaxSpeed = getMaxSpeedFromLevel(upgrades.speedLevel);
  const initialJumpDurationMs = getJumpDurationMs(upgrades.jumpDurationLevel);
  const initialRocketCount = upgrades.rocketStored ?? 0;
  const initialExtraLivesCount = upgrades.extraLivesStored ?? 0;

  const handleRunEnd = useCallback(
    (score: number) => {
      if (score <= 0) return;
      addEarnedFromRun(score).then(({ balance, totalEarned: nextEarned }) => {
        setTotalPoints(balance);
        setTotalEarned(nextEarned);
      });
    },
    []
  );

  return (
    <I18nProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
        {screen === 'entry' && (
          <EntryScreen
            totalPoints={totalPoints}
            totalEarned={totalEarned}
            level={level}
            freeSkiRecord={freeSkiRecord}
            onStartGame={handleStartGame}
            onOpenUpgrades={() => setScreen('upgrades')}
          />
        )}
        {screen === 'upgrades' && (
          <UpgradesScreen
            totalPoints={totalPoints}
            totalEarned={totalEarned}
            level={level}
            upgrades={upgrades}
            onClose={() => setScreen('entry')}
            onPurchase={loadStorage}
          />
        )}
        {screen === 'roadTest' && (
          <RoadTestScreen onBack={() => setScreen('entry')} />
        )}
        {screen === 'game' && (
          <RoadTestScreen
            mode="game"
            mission={mission}
            pathPoints={mission?.points ?? null}
            onBack={() => setScreen('entry')}
            onExit={(score) => {
              if (score > 0) handleRunEnd(score);
            }}
            level={level}
            goodSpawnLevel={upgrades.goodSpawnLevel ?? 0}
            badSpawnLevel={upgrades.badSpawnLevel ?? 0}
            initialRocketCount={upgrades.rocketStored ?? 0}
            initialExtraLivesCount={upgrades.extraLivesStored ?? 0}
          />
        )}
        {/* GameScreen yedek: screens/GameScreen.tsx – ileride alacaklarımıza bakılacak */}
      </SafeAreaView>
    </I18nProvider>
  );
}

export default App;
