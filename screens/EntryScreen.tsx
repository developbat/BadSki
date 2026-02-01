/**
 * Giriş ekranı – Görev getir (4 sn dönen animasyon → önizleme → Başla) veya Serbest Kay
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import {
  createRandomMission,
  pickRandomThemeForRoll,
  SCENARIO_THEMES,
  getMissionDistanceRangeKm,
  type Mission,
  type PathPoint,
} from '../constants/missions';
import { useI18n, SUPPORTED_LOCALES, LOCALE_NAMES, type SupportedLocale } from '../i18n';

const ROLL_DURATION_MS = 4000;
const ROLL_INTERVAL_MS = 120;

const SITTING_IMAGE = require('../assets/skyguy/sitting.png');

type Props = {
  totalPoints: number;
  totalEarned: number;
  level: number;
  freeSkiRecord: number;
  onStartGame: (mission: Mission | null) => void;
  onOpenUpgrades: () => void;
};

const PREVIEW_MAP_WIDTH = 44;
const PREVIEW_MAP_HEIGHT = 100;

function MissionPreview({
  mission,
  onStart,
  onDifferent,
}: {
  mission: Mission;
  onStart: () => void;
  onDifferent: () => void;
}): React.JSX.Element {
  const { t } = useI18n();
  const points = mission.points;
  const maxD = points.length >= 2 ? points[points.length - 1].distanceMeters : 0;
  const maxAbsX = Math.max(1, ...points.map((p) => Math.abs(p.xPx)));
  const scaleX = (PREVIEW_MAP_WIDTH * 0.35) / maxAbsX;

  const pathSegments: { x0: number; y0: number; x1: number; y1: number }[] = [];
  if (points.length >= 2) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      pathSegments.push({
        x0: PREVIEW_MAP_WIDTH / 2 + a.xPx * scaleX,
        y0: (1 - a.distanceMeters / maxD) * PREVIEW_MAP_HEIGHT,
        x1: PREVIEW_MAP_WIDTH / 2 + b.xPx * scaleX,
        y1: (1 - b.distanceMeters / maxD) * PREVIEW_MAP_HEIGHT,
      });
    }
  }

  return (
    <View style={previewStyles.card}>
      <Text style={previewStyles.cardTitle}>{t('entry_mission')}</Text>
      <View style={previewStyles.pathRow}>
        <View style={previewStyles.miniMap}>
          {pathSegments.map((seg, i) => {
            const dx = seg.x1 - seg.x0;
            const dy = seg.y1 - seg.y0;
            const len = Math.hypot(dx, dy) || 1;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const cx = (seg.x0 + seg.x1) / 2;
            const cy = (seg.y0 + seg.y1) / 2;
            return (
              <View
                key={i}
                style={[
                  previewStyles.segment,
                  {
                    left: cx - len / 2,
                    top: cy - 1,
                    width: len,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={previewStyles.info}>
          <Text style={previewStyles.scenarioIcon}>
            {SCENARIO_THEMES.find((t) => t.id === mission.scenarioId)?.icon ?? '🎿'}
          </Text>
          <Text style={previewStyles.name}>{t(('scenario_' + mission.scenarioId) as 'scenario_delivery' | 'scenario_chase' | 'scenario_escape' | 'scenario_survival' | 'scenario_reach')}</Text>
          <Text style={previewStyles.km}>
            {(mission.distanceMeters / 1000).toFixed(0)} km
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.button, styles.buttonPrimary, previewStyles.startBtn]}
        onPress={onStart}
        activeOpacity={0.8}>
        <Text style={styles.buttonText}>{t('entry_start')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={onDifferent}
        activeOpacity={0.8}>
        <Text style={styles.buttonTextSecondary}>{t('entry_differentMission')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.5)',
    minWidth: 260,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  miniMap: {
    width: PREVIEW_MAP_WIDTH,
    height: PREVIEW_MAP_HEIGHT,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    height: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
  },
  info: {
    alignItems: 'flex-start',
  },
  scenarioIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  km: {
    fontSize: 14,
    color: '#94a3b8',
  },
  startBtn: {
    marginBottom: 8,
  },
});

function EntryScreen({ totalPoints, totalEarned, level, freeSkiRecord, onStartGame, onOpenUpgrades }: Props): React.JSX.Element {
  const { t, locale, setLocale } = useI18n();
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'preview'>('idle');
  const [rollingTheme, setRollingTheme] = useState<{ id: string; icon: string } | null>(null);
  const [rollingPoints, setRollingPoints] = useState<PathPoint[]>([]);
  const [mission, setMission] = useState<Mission | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollOpacity = useRef(new Animated.Value(1)).current;

  const handleGetMission = () => {
    setMission(null);
    const { theme, points } = pickRandomThemeForRoll(level);
    setRollingTheme({ id: theme.id, icon: theme.icon });
    setRollingPoints(points);
    setPhase('rolling');
  };

  useEffect(() => {
    if (phase !== 'rolling') return;
    rollOpacity.setValue(1);
    rollIntervalRef.current = setInterval(() => {
      const { theme, points } = pickRandomThemeForRoll(level);
      setRollingTheme({ id: theme.id, icon: theme.icon });
      setRollingPoints(points);
    }, ROLL_INTERVAL_MS);
    const timeout = setTimeout(() => {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }
      const chosen = createRandomMission(level);
      setMission(chosen);
      setPhase('preview');
    }, ROLL_DURATION_MS);
    return () => {
      clearTimeout(timeout);
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    };
  }, [phase, rollOpacity, level]);

  if (phase === 'preview' && mission) {
    return (
      <View style={styles.container}>
        <View style={styles.entryContent}>
        <StatusBar barStyle="light-content" backgroundColor={styles.container.backgroundColor} />
        <View style={styles.topBar}>
          <View>
            <Text style={styles.pointsBadge}>⭐ {totalPoints}</Text>
            <Text style={styles.totalEarnedBadge}>Lv.{level} · {totalEarned} {t('entry_totalEarned')}</Text>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.upgradesButton} onPress={onOpenUpgrades} activeOpacity={0.8}>
              <Text style={styles.upgradesButtonText}><Text style={styles.greenArrow}>↑</Text> {t('entry_upgrades')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.langButton} onPress={() => setShowLangPicker(true)} activeOpacity={0.8}>
              <Text style={styles.langButtonText}>🌐 {locale.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.title}>{t('appTitle')}</Text>
        <Image source={SITTING_IMAGE} style={styles.sittingImage} resizeMode="contain" />
        <MissionPreview
          mission={mission}
          onStart={() => onStartGame(mission)}
          onDifferent={() => {
            setPhase('idle');
            setMission(null);
          }}
        />
        {showLangPicker ? (
          <View style={styles.langPickerOverlay}>
            <View style={styles.langPicker}>
              <Text style={styles.langPickerTitle}>{t('entry_languagePicker')}</Text>
              {SUPPORTED_LOCALES.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[styles.langOption, locale === loc && styles.langOptionActive]}
                  onPress={() => {
                    setLocale(loc as SupportedLocale);
                    setShowLangPicker(false);
                  }}
                  activeOpacity={0.8}>
                  <Text style={styles.langOptionText}>{LOCALE_NAMES[loc as SupportedLocale]}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.langPickerClose} onPress={() => setShowLangPicker(false)} activeOpacity={0.8}>
                <Text style={styles.closeButtonText}>{t('upgrades_close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        </View>
      </View>
    );
  }

  if (phase === 'rolling' && rollingTheme) {
    const points = rollingPoints;
    const maxD = points.length >= 2 ? points[points.length - 1].distanceMeters : 1;
    const maxAbsX = Math.max(1, ...points.map((p) => Math.abs(p.xPx)));
    const scaleX = (PREVIEW_MAP_WIDTH * 0.35) / maxAbsX;
    const pathSegments: { x0: number; y0: number; x1: number; y1: number }[] = [];
    if (points.length >= 2) {
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        pathSegments.push({
          x0: PREVIEW_MAP_WIDTH / 2 + a.xPx * scaleX,
          y0: (1 - a.distanceMeters / maxD) * PREVIEW_MAP_HEIGHT,
          x1: PREVIEW_MAP_WIDTH / 2 + b.xPx * scaleX,
          y1: (1 - b.distanceMeters / maxD) * PREVIEW_MAP_HEIGHT,
        });
      }
    }
    return (
      <View style={styles.container}>
        <View style={styles.entryContent}>
        <StatusBar barStyle="light-content" backgroundColor={styles.container.backgroundColor} />
        <View style={styles.topBar}>
          <View>
            <Text style={styles.pointsBadge}>⭐ {totalPoints}</Text>
            <Text style={styles.totalEarnedBadge}>Lv.{level} · {totalEarned} {t('entry_totalEarned')}</Text>
          </View>
        </View>
        <Text style={styles.title}>{t('appTitle')}</Text>
        <Image source={SITTING_IMAGE} style={styles.sittingImage} resizeMode="contain" />
        <Text style={styles.rollingLabel}>{t('entry_scenariosComing')}</Text>
        <Animated.View style={[styles.rollingBox, { opacity: rollOpacity }]}>
          <View style={previewStyles.pathRow}>
            <View style={previewStyles.miniMap}>
              {pathSegments.map((seg, i) => {
                const dx = seg.x1 - seg.x0;
                const dy = seg.y1 - seg.y0;
                const len = Math.hypot(dx, dy) || 1;
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                const cx = (seg.x0 + seg.x1) / 2;
                const cy = (seg.y0 + seg.y1) / 2;
                return (
                  <View
                    key={i}
                    style={[
                      previewStyles.segment,
                      {
                        left: cx - len / 2,
                        top: cy - 1,
                        width: len,
                        transform: [{ rotate: `${angle}deg` }],
                      },
                    ]}
                  />
                );
              })}
            </View>
            <View style={previewStyles.info}>
              <Text style={previewStyles.scenarioIcon}>{rollingTheme.icon}</Text>
              <Text style={styles.rollingText}>
                {t(('scenario_' + rollingTheme.id) as 'scenario_delivery' | 'scenario_chase' | 'scenario_escape' | 'scenario_survival' | 'scenario_reach')}
              </Text>
            </View>
          </View>
        </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.entryContent}>
      <StatusBar barStyle="light-content" backgroundColor={styles.container.backgroundColor} />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.pointsBadge}>⭐ {totalPoints}</Text>
          <Text style={styles.totalEarnedBadge}>Lv.{level} · {totalEarned} {t('entry_totalEarned')}</Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.upgradesButton} onPress={onOpenUpgrades} activeOpacity={0.8}>
            <Text style={styles.upgradesButtonText}><Text style={styles.greenArrow}>↑</Text> {t('entry_upgrades')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.langButton} onPress={() => setShowLangPicker(true)} activeOpacity={0.8}>
            <Text style={styles.langButtonText}>🌐 {locale.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.title}>{t('appTitle')}</Text>
      <Image source={SITTING_IMAGE} style={styles.sittingImage} resizeMode="contain" />
      <View style={styles.getMissionWrap}>
        <Text style={styles.levelBadge}>Lv.{level}</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleGetMission}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t('entry_getMission')}</Text>
          <Text style={styles.buttonHint}>{t('entry_getMissionHint', getMissionDistanceRangeKm(level))}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => onStartGame(null)}
        activeOpacity={0.8}>
        <Text style={styles.buttonTextSecondary}>{t('entry_freeSki')}</Text>
        {freeSkiRecord > 0 ? (
          <Text style={styles.buttonHint}>
            {t('entry_freeSkiRecord', {
              distance: freeSkiRecord >= 1000
                ? `${(freeSkiRecord / 1000).toFixed(1)} km`
                : `${Math.round(freeSkiRecord)} m`,
            })}
          </Text>
        ) : null}
      </TouchableOpacity>
      {showLangPicker ? (
        <View style={styles.langPickerOverlay}>
          <View style={styles.langPicker}>
            <Text style={styles.langPickerTitle}>{t('entry_languagePicker')}</Text>
            {SUPPORTED_LOCALES.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.langOption, locale === loc && styles.langOptionActive]}
                onPress={() => {
                  setLocale(loc as SupportedLocale);
                  setShowLangPicker(false);
                }}
                activeOpacity={0.8}>
                <Text style={styles.langOptionText}>{LOCALE_NAMES[loc as SupportedLocale]}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.langPickerClose} onPress={() => setShowLangPicker(false)} activeOpacity={0.8}>
              <Text style={styles.closeButtonText}>{t('upgrades_close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
  },
  entryContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  pointsBadge: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fbbf24',
  },
  totalEarnedBadge: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(100, 116, 139, 0.35)',
  },
  langButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  upgradesButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(100, 116, 139, 0.4)',
  },
  upgradesButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  greenArrow: {
    color: '#22c55e',
    fontWeight: '800',
    fontSize: 16,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 4,
  },
  sittingImage: {
    width: 180,
    height: 140,
    marginBottom: 20,
  },
  rollingLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  getMissionWrap: {
    alignItems: 'center',
  },
  levelBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 220,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonPrimary: {
    backgroundColor: '#0ea5e9',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#64748b',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  buttonHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  buttonTextSecondary: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94a3b8',
  },
  rollingBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 32,
    minWidth: 220,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.5)',
  },
  rollingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  langPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  langPicker: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 20,
    minWidth: 260,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.4)',
  },
  langPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
    textAlign: 'center',
  },
  langOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
  },
  langOptionActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.35)',
  },
  langOptionText: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  langPickerClose: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
});

export default EntryScreen;
