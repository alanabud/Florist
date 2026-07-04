/**
 * Localizable errors for non-React layers (stores/services).
 *
 * Stores can't call the useI18n hook, so guard failures throw a
 * LocalizedError carrying an i18n key + params alongside a plain-English
 * message (the fallback for logs and any non-i18n consumer). UI catch sites
 * resolve the user-facing text with localizeError(err, t, fallbackKey).
 */
export class LocalizedError extends Error {
  readonly i18nKey: string;
  readonly params?: Record<string, string | number>;

  constructor(i18nKey: string, fallbackMessage: string, params?: Record<string, string | number>) {
    super(fallbackMessage);
    this.name = 'LocalizedError';
    this.i18nKey = i18nKey;
    this.params = params;
  }
}

/** Resolve an unknown thrown value to user-facing text in the active locale. */
export function localizeError(
  err: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
  fallbackKey?: string
): string {
  if (err instanceof LocalizedError) return t(err.i18nKey, err.params);
  const message = (err as Error | undefined)?.message;
  if (message) return message;
  return fallbackKey ? t(fallbackKey) : '';
}
