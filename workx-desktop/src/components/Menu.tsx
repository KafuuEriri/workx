import { Check } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { cn } from '../lib/cn';

interface MenuProps {
  open: boolean;
  onClose: () => void;
  align?: 'left' | 'right';
  children: ReactNode;
}

export function Menu({ open, onClose, align = 'left', children }: MenuProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        className={cn(
          'absolute bottom-full z-50 mb-2 min-w-[280px] rounded-xl border border-line bg-elevated p-1 shadow-xl',
          align === 'right' ? 'right-0' : 'left-0',
        )}
      >
        {children}
      </div>
    </>
  );
}

interface MenuItemProps {
  title: string;
  description?: string;
  selected?: boolean;
  onClick: () => void;
}

export function MenuItem({ title, description, selected = false, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-hover"
    >
      <Check
        className={cn('mt-0.5 size-3.5 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
        strokeWidth={2}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-fg-tertiary">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
