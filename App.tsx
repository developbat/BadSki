/**
 * Badski - Yokuş aşağı kayak oyunu
 * Giriş: Puan, Yükseltmeler, Görev getir / Serbest kay
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native';
import { I18nProvider } from './i18n';
import EntryScreen from './screens/EntryScreen';
import GameScreen from './screens/GameScreen';
import UpgradesScreen from './screens/UpgradesScreen';
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

type Screen = 'entry' | 'game' | 'upgrades';

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
        {screen === 'game' && (
          <GameScreen
            mission={mission}
            totalEarned={totalEarned}
            level={level}
            initialMaxSpeed={initialMaxSpeed}
            initialJumpDurationMs={initialJumpDurationMs}
            initialRocketCount={initialRocketCount}
            initialExtraLivesCount={initialExtraLivesCount}
            startWithGhostSeconds={startWithGhostSeconds}
            onExit={(score: number, distanceMeters?: number) => {
              handleRunEnd(score);
              if (mission === null && distanceMeters != null && distanceMeters > 0) {
                updateFreeSkiRecordIfBetter(distanceMeters).then((newRecord) => {
                  if (newRecord === distanceMeters) setFreeSkiRecord(distanceMeters);
                });
              }
              setScreen('entry');
            }}
            onRunEnd={handleRunEnd}
            onUseRocket={async () => {
              const u = await getUpgrades();
              await setUpgrades({ ...u, rocketStored: Math.max(0, (u.rocketStored ?? 0) - 1) });
              loadStorage();
            }}
            onUseExtraLife={async () => {
              const u = await getUpgrades();
              await setUpgrades({ ...u, extraLivesStored: Math.max(0, (u.extraLivesStored ?? 0) - 1) });
              loadStorage();
            }}
          />
        )}
      </SafeAreaView>
    </I18nProvider>
  );
}

export default App;
