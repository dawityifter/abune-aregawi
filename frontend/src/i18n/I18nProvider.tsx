import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react';
import { dictionaries, type Dictionaries, type Lang } from './dictionaries';

const LS_KEY = 'app.lang';

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dict: Dictionaries;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function getBrowserLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const pref = (navigator.languages?.[0] || navigator.language || 'en').slice(0, 2).toLowerCase();
  return pref === 'ti' ? 'ti' : 'en';
}

function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(LS_KEY) as Lang | null;
    if (stored === 'en' || stored === 'ti') return stored;
  } catch { }
  return getBrowserLang();
}

function getByPath(obj: any, path: string): any {
  return path.split('.').reduce((acc: any, part: string) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return acc[part];
    }
    return undefined;
  }, obj);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getInitialLang());

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch { }
  }, [lang]);

  const dict = useMemo(() => dictionaries[lang], [lang]);

  const setLang = (l: Lang) => setLangState(l);

  const t = useMemo(() => {
    return (key: string) => {
      const val = getByPath(dict, key);
      if (typeof val === 'string') return val;
      // Fallback: try English if missing in current dict
      const fallback = getByPath(dictionaries.en, key);
      return typeof fallback === 'string' ? fallback : key;
    };
  }, [dict]);

  const value: I18nContextValue = useMemo(() => ({ lang, setLang, t, dict }), [lang, t, dict]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
