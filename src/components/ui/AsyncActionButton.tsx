import React, { useState } from 'react';
import { Button } from './Button';

type BaseButtonProps = React.ComponentProps<typeof Button>;

interface AsyncActionButtonProps extends Omit<BaseButtonProps, 'onClick' | 'isLoading'> {
  /** Async (or sync) handler. Repeat clicks while it is in flight are ignored. */
  onClick: () => void | Promise<void>;
  /** Optional label shown while the action is pending (e.g. "Posting…"). */
  pendingLabel?: React.ReactNode;
}

/**
 * Single-flight wrapper around the Button primitive for async actions.
 * While the handler is in flight it ignores repeat clicks, auto-disables, shows
 * the Button spinner, and (optionally) swaps to a pending label — preventing
 * duplicate writes/postings from double-clicks. All Button styling/props
 * (className, style, variant, size, …) pass straight through, so the trigger's
 * appearance is unchanged.
 */
export const AsyncActionButton: React.FC<AsyncActionButtonProps> = ({
  onClick,
  children,
  pendingLabel,
  disabled,
  ...rest
}) => {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    if (pending) return; // single-flight: ignore repeat clicks while in flight
    setPending(true);
    try {
      await onClick();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      {...rest}
      onClick={handleClick}
      isLoading={pending}
      disabled={disabled || pending}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
};
