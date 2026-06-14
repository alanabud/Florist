import { enUS } from './locales/en-US';
import { esUS } from './locales/es-US';
import { frFR } from './locales/fr-FR';
import { nlNL } from './locales/nl-NL';

export type SupportedLanguageCode = 'en-US' | 'es-US' | 'fr-FR' | 'nl-NL';

export const LOCALES: Record<SupportedLanguageCode, typeof enUS> = {
  'en-US': enUS,
  'es-US': esUS,
  'fr-FR': frFR,
  'nl-NL': nlNL,
};

export const DEFAULT_LANGUAGE: SupportedLanguageCode = 'en-US';

export function getNestedTranslation(obj: any, path: string): string | undefined {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}
