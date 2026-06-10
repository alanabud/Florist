import React from 'react';
import { Button } from './Button';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 2rem',
      textAlign: 'center',
      background: '#FCFAF7',
      borderRadius: '12px',
      border: '1px dashed #E5E0D8',
      maxWidth: '500px',
      margin: '2rem auto'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: '#F5F1E7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1rem',
        color: 'var(--color-sage-dark)'
      }}>
        <Inbox size={22} />
      </div>
      <h3 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '1.125rem',
        fontWeight: 600,
        color: 'var(--color-text-main)',
        margin: '0 0 0.5rem 0'
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '0.875rem',
        color: '#726E64',
        margin: '0 0 1.5rem 0',
        lineHeight: 1.5
      }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
};
