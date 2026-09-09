import { Columns2, FileText, MoreHorizontal, PanelRight, Share2 } from 'lucide-react';

import { cn } from '../lib/cn';
import { useI18n, type MessageKey } from '../lib/i18n';
import { IconButton } from './IconButton';

export type ConnectionStatus = 'connecting' | 'ready' | 'error' | 'stopped';

interface TopBarProps {
  title: string;
  subtitle?: string | null;
  status: ConnectionStatus;
}

const STATUS_STYLE: Record<ConnectionStatus, { dot: string; labelKey: MessageKey }> = {
  connecting: { dot: 'bg-amber-500', labelKey: 'topbar.connecting' },
  ready: { dot: 'bg-emerald-500', labelKey: 'topbar.connected' },
  error: { dot: 'bg-danger', labelKey: 'topbar.disconnected' },
  stopped: { dot: 'bg-fg-tertiary', labelKey: 'topbar.stopped' },
};

export function TopBar({ title, subtitle, status }: TopBarProps) {
  const { t } = useI18n();
  const statusStyle = STATUS_STYLE[status];
  return (
    <header className="drag flex h-[52px] shrink-0 items-center gap-2 px-3">
      <div className="no-drag flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-fg-secondary">
        <FileText className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="max-w-[420px] truncate">{title}</span>
        {subtitle ? (
          <span className="max-w-[220px] truncate text-fg-tertiary">{subtitle}</span>
        ) : null}
        <MoreHorizontal className="size-3.5 shrink-0" strokeWidth={1.75} />
      </div>

      <div className="no-drag ml-auto flex items-center gap-0.5">
        <div className="mr-1 flex items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-tertiary">
          <span className={cn('size-1.5 rounded-full', statusStyle.dot)} />
          {t(statusStyle.labelKey)}
        </div>
        <button
          type="button"
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-fg-secondary hover:bg-hover"
        >
          <Share2 className="size-3.5" strokeWidth={1.75} />
          {t('topbar.share')}
        </button>
        <IconButton size="sm" aria-label={t('topbar.toggleSplit')}>
          <Columns2 className="size-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton size="sm" aria-label={t('topbar.toggleSidePanel')}>
          <PanelRight className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>
    </header>
  );
}
