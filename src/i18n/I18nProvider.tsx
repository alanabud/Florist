import React, { createContext, useState, useContext, useEffect } from 'react';
import { LOCALES, DEFAULT_LANGUAGE, getNestedTranslation, type SupportedLanguageCode } from './index';

interface I18nContextType {
  language: SupportedLanguageCode;
  setLanguage: (language: SupportedLanguageCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (value: any) => string;
  formatDateTime: (value: any) => string;
  formatCurrency: (amount: number, currencyCode?: string) => string;
  formatNumber: (value: number) => string;
  formatPercent: (value: number) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Determine initial language: localStorage -> browser -> fallback
  const getInitialLanguage = (): SupportedLanguageCode => {
    const saved = localStorage.getItem('bloompro-lang') as SupportedLanguageCode;
    if (saved && LOCALES[saved]) return saved;

    const browserLang = navigator.language;
    if (browserLang.startsWith('es')) return 'es-US';
    if (browserLang.startsWith('fr')) return 'fr-FR';
    if (browserLang.startsWith('nl')) return 'nl-NL';

    return DEFAULT_LANGUAGE;
  };

  const [language, setLanguageState] = useState<SupportedLanguageCode>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language.split('-')[0];
  }, [language]);

  const setLanguage = (lang: SupportedLanguageCode) => {
    if (LOCALES[lang]) {
      setLanguageState(lang);
      localStorage.setItem('bloompro-lang', lang);
    }
  };

  // 1. Translation Function (t)
  const t = (key: string, params?: Record<string, string | number>): string => {
    const activeDict = LOCALES[language];
    const defaultDict = LOCALES[DEFAULT_LANGUAGE];

    let translation = getNestedTranslation(activeDict, key) || getNestedTranslation(defaultDict, key);

    if (translation === undefined) {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing translation key: "${key}" for language "${language}"`);
      }
      return key; // Fallback to raw key
    }

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        translation = translation!.replace(new RegExp(`{${k}}`, 'g'), String(v));
      });
    }

    return translation!;
  };

  // Helper to parse dates from various formats (string, Timestamp, Date)
  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (val && typeof val === 'object' && 'toDate' in val) return val.toDate();
    if (val?.seconds) return new Date(val.seconds * 1000);
    return new Date(val);
  };

  // 2. Date Formatter
  const formatDate = (value: any): string => {
    const d = parseDate(value);
    return new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  };

  // 3. DateTime Formatter
  const formatDateTime = (value: any): string => {
    const d = parseDate(value);
    return new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(d);
  };

  // 4. Currency Formatter
  const formatCurrency = (amount: number, currencyCode = 'USD'): string => {
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // 5. Number Formatter
  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat(language).format(value || 0);
  };

  // 6. Percentage Formatter
  const formatPercent = (value: number): string => {
    return new Intl.NumberFormat(language, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format((value || 0) / 100);
  };

  return (
    <I18nContext.Provider value={{
      language,
      setLanguage,
      t,
      formatDate,
      formatDateTime,
      formatCurrency,
      formatNumber,
      formatPercent
    }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
