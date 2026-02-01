/**
 * i18n context – dil seçimi ve t() fonksiyonu.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedLocale } from './types';
import { messages, interpolate } from './translations';
import type { TranslationKeys } from './types';

const STORAGE_KEY = '@badski/locale';

type I18nContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: keyof TranslationKeys, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const DEFAULT_LOCALE: SupportedLocale = 'tr';

export function I18nProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && (messages as Record<string, unknown>)[stored]) {
        setLocaleState(stored as SupportedLocale);
      }
      setReady(true);
    });
  }, []);

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: keyof TranslationKeys, vars?: Record<string, string | number>): string => {
      const text = messages[locale][key];
      if (vars) return interpolate(text, vars);
      return text;
    },
    [locale]
  );

  const value: I18nContextValue = { locale, setLocale, t };

  if (!ready) {
    return (
      <I18nContext.Provider value={{ locale: DEFAULT_LOCALE, setLocale, t }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
