import React from 'react';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface ModuleErrorStateProps {
  /** Optional overrides; default to generic i18n copy. */
  title?: string;
  description?: string;
  /** Optional technical detail (e.g. a store error message), shown muted. */
  detail?: string;
  /** Wire to an existing fetch/reload handler; renders a retry button. */
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Inline "failed to load" card for a single module/list — a lighter,
 * display-level sibling of CompanyGuard's error state. Shows only on an actual
 * load failure; uses theme tokens (no hardcoded colors).
 */
export const ModuleErrorState: React.FC<ModuleErrorStateProps> = ({
  title,
  description,
  detail,
  onRetry,
  retryLabel,
}) => {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 2rem',
        textAlign: 'center',
        background: 'var(--color-blush-light)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-blush)',
        maxWidth: '500px',
        margin: '2rem auto',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--color-white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
          color: 'var(--color-error)',
        }}
      >
        <AlertCircle size={22} />
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--color-text-main)',
          margin: '0 0 0.5rem 0',
        }}
      >
        {title ?? t('common.loadFailedTitle')}
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
        {description ?? t('common.loadFailedMessage')}
      </p>
      {detail && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', margin: '0 0 1.5rem 0', fontFamily: 'monospace', wordBreak: 'break-word' }}>
          {detail}
        </p>
      )}
      {onRetry && <Button onClick={onRetry}>{retryLabel ?? t('common.retry')}</Button>}
    </div>
  );
};
