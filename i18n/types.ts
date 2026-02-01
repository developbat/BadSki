/**
 * Dil desteği – anahtarlar ve desteklenen diller.
 */

export type SupportedLocale =
  | 'en'
  | 'tr'
  | 'de'
  | 'fr'
  | 'pt'
  | 'es'
  | 'ru'
  | 'ja';

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  'en',
  'tr',
  'de',
  'fr',
  'pt',
  'es',
  'ru',
  'ja',
];

/** Dil adları (kendi dilinde) – dil seçicide gösterilir */
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  pt: 'Português',
  es: 'Español',
  ru: 'Русский',
  ja: '日本語',
};

export type TranslationKeys = {
  appTitle: string;
  entry_subtitle: string;
  entry_getMission: string;
  entry_getMissionHint: string;
  entry_freeSki: string;
  entry_freeSkiRecord: string;
  entry_upgrades: string;
  entry_scenariosComing: string;
  entry_mission: string;
  entry_start: string;
  entry_differentMission: string;
  entry_languagePicker: string;
  entry_totalEarned: string;
  upgrades_title: string;
  upgrades_yourPoints: string;
  upgrades_close: string;
  upgrades_maxSpeed: string;
  upgrades_maxSpeedDesc: string;
  upgrades_level: string;
  upgrades_maxed: string;
  upgrades_ghostMode: string;
  upgrades_ghostModeDesc: string;
  upgrades_buy: string;
  upgrades_extraLife: string;
  upgrades_extraLifeDesc: string;
  upgrades_extraLifeCount: string;
  game_goalReached: string;
  game_missionComplete: string;
  game_completionBonus: string;
  game_backToMenu: string;
  game_playAgain: string;
  game_jump: string;
  scenario_delivery: string;
  scenario_chase: string;
  scenario_escape: string;
  scenario_survival: string;
  scenario_reach: string;
  upgrades_jumpDuration: string;
  upgrades_jumpDurationDesc: string;
  upgrades_rocket: string;
  upgrades_rocketDesc: string;
  game_rocket: string;
  upgrades_pointsProductTitle: string;
  upgrades_pointsProductDesc: string;
  upgrades_watchAdForPoints: string;
  upgrades_watchAdToUnlock: string;
};

export type LocaleMessages = Record<SupportedLocale, TranslationKeys>;
