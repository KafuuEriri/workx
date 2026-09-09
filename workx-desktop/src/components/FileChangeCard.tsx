import { FileDiff, RotateCcw, Undo2 } from 'lucide-react';
import { useRef, useState } from 'react';

import type { FileUpdateChange } from '@protocol/v2/FileUpdateChange';
import { basename, diffLines, diffStats, relativeTo, type DiffLine } from '../lib/diff';
import { cn } from '../lib/cn';
import { useI18n } from '../lib/i18n';

interface FileChangeCardProps {
  change: FileUpdateChange;
  cwd: string;
  onUndo: (change: FileUpdateChange) => Promise<void> | void;
  onExpand?: (element: HTMLElement) => void;
}

function changeLabelKey(change: FileUpdateChange) {
  if (change.kind.type === 'add') {
    return 'fileChange.added' as const;
  }
  if (change.kind.type === 'delete') {
    return 'fileChange.deleted' as const;
  }
  return 'fileChange.edited' as const;
}

function DiffLineRow({ line }: { line: DiffLine }) {
  if (line.kind === 'hunk' || line.kind === 'meta') {
    return (
      <div className="px-3 py-1 font-mono text-[12px] text-fg-tertiary">{line.text}</div>
    );
  }
  const sign = line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' ';
  return (
    <div
      className={cn(
        'flex gap-2 px-3 font-mono text-[12px] leading-5',
        line.kind === 'add' && 'bg-emerald-500/10',
        line.kind === 'remove' && 'bg-red-500/10',
      )}
    >
      <span
        className={cn(
          'w-2 shrink-0 select-none text-center',
          line.kind === 'add' && 'text-emerald-600',
          line.kind === 'remove' && 'text-red-600',
          line.kind === 'context' && 'text-fg-tertiary',
        )}
      >
        {sign}
      </span>
      <span className="min-w-0 whitespace-pre-wrap break-words">{line.text || ' '}</span>
    </div>
  );
}

export function FileChangeCard({ change, cwd, onUndo, onExpand }: FileChangeCardProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stats = diffStats(change);
  const displayPath = relativeTo(cwd, change.path);

  const undo = async () => {
    setBusy(true);
    try {
      await onUndo(change);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && onExpand) {
      window.requestAnimationFrame(() => {
        if (rootRef.current) {
          onExpand(rootRef.current);
        }
      });
    }
  };

  return (
    <div
      ref={rootRef}
      className="my-1.5 overflow-hidden rounded-xl border border-line bg-elevated"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-app text-fg-secondary">
          <FileDiff className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px]">
            <span className="text-fg-secondary">{t(changeLabelKey(change))} </span>
            <span className="font-medium">{basename(change.path)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[12px]">
            <span className="text-emerald-600">+{stats.additions}</span>
            <span className="text-red-600">-{stats.deletions}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void undo()}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-fg-secondary hover:bg-hover disabled:opacity-50"
          >
            <Undo2 className="size-3.5" strokeWidth={1.75} />
            {t('fileChange.undo')}
          </button>
          <button
            type="button"
            onClick={toggle}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] hover:bg-hover"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            {open ? t('fileChange.hideChanges') : t('fileChange.review')}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-line">
          <div className="flex items-center justify-between px-3 py-1.5 text-[12px] text-fg-tertiary">
            <span className="truncate font-mono">{displayPath}</span>
            <span className="shrink-0">
              <span className="text-emerald-600">+{stats.additions}</span>{' '}
              <span className="text-red-600">-{stats.deletions}</span>
            </span>
          </div>
          <div className="max-h-[420px] overflow-auto border-t border-line-subtle py-1">
            {diffLines(change).map((line, index) => (
              <DiffLineRow key={`${index}-${line.text}`} line={line} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
