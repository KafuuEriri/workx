import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

type IconButtonSize = 'sm' | 'md';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  active?: boolean;
}

export function IconButton({
  className,
  size = 'md',
  active = false,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'no-drag inline-flex shrink-0 items-center justify-center rounded-md text-fg-secondary',
        'transition-colors hover:bg-hover hover:text-fg',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'size-6' : 'size-7',
        active && 'bg-active text-fg',
        className,
      )}
      {...props}
    />
  );
}
