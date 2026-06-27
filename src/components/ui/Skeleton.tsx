import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** A single shimmering placeholder block. Uses theme tokens for color/radius. */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  radius = 'var(--radius-md)',
  className,
  style,
}) => (
  <span
    aria-hidden="true"
    className={`${styles.skeleton} ${className ?? ''}`}
    style={{ width, height, borderRadius: radius, ...style }}
  />
);

/** A stack of skeleton text lines; the last line is shortened. */
export const SkeletonText: React.FC<{ lines?: number; width?: string }> = ({ lines = 3, width = '100%' }) => (
  <span className={styles.stack} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} height="0.75rem" width={i === lines - 1 ? '60%' : width} />
    ))}
  </span>
);

/** A KPI/summary card placeholder. */
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 2 }) => (
  <div className={styles.card} role="status" aria-label="Loading">
    <Skeleton width="42%" height="0.75rem" />
    <Skeleton width="68%" height="1.75rem" />
    {lines > 2 && <Skeleton width="54%" height="0.75rem" />}
  </div>
);

/** Rows of skeleton cells, sized to mirror a data table while it loads. */
export const SkeletonTableRows: React.FC<{ rows?: number; cols?: number }> = ({ rows = 6, cols = 5 }) => (
  <div className={styles.tableRows} role="status" aria-label="Loading">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className={styles.tableRow} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} height="0.875rem" width={c === 0 ? '70%' : '100%'} />
        ))}
      </div>
    ))}
  </div>
);
