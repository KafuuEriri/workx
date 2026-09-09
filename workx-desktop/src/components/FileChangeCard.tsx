import { FileDiff, Undo2 } from 'lucide-react';
import { useState } from 'react';

import type { FileUpdateChange } from '@protocol/v2/FileUpdateChange';
import { basename, diffStats, relativeTo } from '../lib/diff';
import { useI18n } from '../lib/i18n';

interface FileChangeCardProps {
  change: FileUpdateChange;
  cwd: string;
  onUndo: (change: FileUpdateChange) => Promise<void> | void;
  onReview: (change: FileUpdateChange) => void;
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

export function FileChangeCard({ change, cwd, onUndo, onReview }: FileChangeCardProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
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

  return (
    <div className="my-1.5 flex items-center gap-3 rounded-xl border border-line bg-elevated px-3 py-2.5">
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
          <span className="truncate text-fg-tertiary">{displayPath}</span>
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
          onClick={() => onReview(change)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] hover:bg-hover"
        >
          <FileDiff className="size-3.5" strokeWidth={1.75} />
          {t('fileChange.review')}
        </button>
      </div>
    </div>
  );
}
