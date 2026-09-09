import { ArrowUp, GitBranch, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { GitFileStatus, GitStatusResult } from '../preload';
import type { FileUpdateChange } from '@protocol/v2/FileUpdateChange';
import { diffLines, gitDiffLines, type DiffLine } from '../lib/diff';
import { cn } from '../lib/cn';
import { useI18n } from '../lib/i18n';

type Scope = 'unstaged' | 'staged';

interface ReviewPanelProps {
  cwd: string;
  onClose: () => void;
  onChanged: () => void;
  focusChange?: FileUpdateChange | null;
}

function statusLetter(file: GitFileStatus): string {
  if (file.untracked) {
    return 'U';
  }
  const code = file.code.trim();
  return code.length > 0 ? code[code.length - 1] : '?';
}

function DiffRow({ line }: { line: DiffLine }) {
  if (line.kind === 'meta' || line.kind === 'hunk') {
    return <div className="px-3 py-0.5 font-mono text-[12px] text-fg-tertiary">{line.text}</div>;
  }
  return (
    <div
      className={cn(
        'px-3 font-mono text-[12px] leading-5 whitespace-pre-wrap break-words',
        line.kind === 'add' && 'bg-emerald-500/10',
        line.kind === 'remove' && 'bg-red-500/10',
      )}
    >
      {line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}
      {line.text}
    </div>
  );
}

export function ReviewPanel({ cwd, onClose, onChanged, focusChange }: ReviewPanelProps) {
  const { t } = useI18n();
  const [scope, setScope] = useState<Scope>('unstaged');
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [stats, setStats] = useState<Record<string, { additions: number; deletions: number }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<FileUpdateChange | null>(null);
  const [diff, setDiff] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextStatus, numstat] = await Promise.all([
      window.workx.gitStatus(cwd),
      window.workx.gitNumstat(cwd, scope),
    ]);
    setStatus(nextStatus);
    const nextStats: Record<string, { additions: number; deletions: number }> = {};
    for (const entry of numstat) {
      nextStats[entry.path] = { additions: entry.additions, deletions: entry.deletions };
    }
    setStats(nextStats);
  }, [cwd, scope]);

  useEffect(() => {
    setSelected(null);
    setDiff('');
    void refresh();
  }, [refresh]);

  const files = useMemo(() => {
    const all = status?.files ?? [];
    if (scope === 'staged') {
      return all.filter((file) => file.staged);
    }
    return all.filter((file) => file.unstaged || file.untracked);
  }, [scope, status]);

  const openFile = useCallback(
    async (path: string) => {
      setFocused(null);
      setSelected(path);
      const result = await window.workx.gitDiff(cwd, scope, path);
      setDiff(result.diff);
    },
    [cwd, scope],
  );

  useEffect(() => {
    if (!focusChange) {
      return;
    }
    setFocused(focusChange);
    setSelected(focusChange.path);
  }, [focusChange]);

  const runAction = useCallback(
    async (action: () => Promise<{ ok: boolean; stderr: string }>) => {
      setBusy(true);
      try {
        const result = await action();
        if (!result.ok) {
          setNotice(result.stderr || t('review.actionFailed'));
        } else {
          setNotice(null);
          await refresh();
          if (selected) {
            const next = await window.workx.gitDiff(cwd, scope, selected);
            setDiff(next.diff);
          }
          onChanged();
        }
      } finally {
        setBusy(false);
      }
    },
    [cwd, onChanged, refresh, scope, selected, t],
  );

  const commit = useCallback(async () => {
    if (!message.trim()) {
      return;
    }
    setBusy(true);
    try {
      const result = await window.workx.gitCommit(cwd, message.trim());
      if (!result.ok) {
        setNotice(result.stderr || t('review.commitFailed'));
      } else {
        setMessage('');
        setNotice(t('review.committed'));
        await refresh();
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }, [cwd, message, onChanged, refresh, t]);

  const push = useCallback(async () => {
    setBusy(true);
    try {
      const result = await window.workx.gitPush(cwd);
      setNotice(result.ok ? t('review.pushed') : result.stderr || t('review.pushFailed'));
    } finally {
      setBusy(false);
    }
  }, [cwd, t]);

  return (
    <aside className="flex h-full w-[460px] shrink-0 flex-col border-l border-line bg-app">
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
        <span className="text-[14px] font-medium">{t('review.title')}</span>
        {status?.branch ? (
          <span className="flex items-center gap-1 text-[12px] text-fg-tertiary">
            <GitBranch className="size-3.5" strokeWidth={1.75} />
            {status.branch}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="ml-auto flex size-7 items-center justify-center rounded-md text-fg-tertiary hover:bg-hover hover:text-fg"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      {status && !status.isRepo ? (
        <div className="px-4 py-6 text-[13px] text-fg-secondary">{t('review.notARepo')}</div>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-1 px-4 pb-2">
            {(['unstaged', 'staged'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={cn(
                  'h-7 rounded-md px-2.5 text-[13px]',
                  scope === value ? 'bg-hover text-fg' : 'text-fg-secondary hover:bg-hover',
                )}
              >
                {t(value === 'unstaged' ? 'review.unstaged' : 'review.staged')}
              </button>
            ))}
          </div>

          <div className="max-h-[38%] shrink-0 overflow-y-auto border-y border-line">
            {files.length === 0 ? (
              <div className="px-4 py-6 text-[13px] text-fg-tertiary">{t('review.noChanges')}</div>
            ) : (
              files.map((file) => {
                const fileStats = stats[file.path];
                return (
                  <div
                    key={file.path}
                    className={cn(
                      'group flex items-center gap-2 px-4 py-1.5 text-[13px]',
                      selected === file.path ? 'bg-hover' : 'hover:bg-hover',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void openFile(file.path)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="w-3 shrink-0 text-center font-mono text-[12px] text-fg-tertiary">
                        {statusLetter(file)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                        {file.path}
                      </span>
                      {fileStats ? (
                        <span className="shrink-0 text-[12px]">
                          <span className="text-emerald-600">+{fileStats.additions}</span>{' '}
                          <span className="text-red-600">-{fileStats.deletions}</span>
                        </span>
                      ) : null}
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {scope === 'unstaged' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runAction(() => window.workx.gitStage(cwd, file.path))}
                          className="rounded px-1.5 py-0.5 text-[12px] text-fg-secondary hover:bg-app"
                        >
                          {t('review.stage')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runAction(() => window.workx.gitUnstage(cwd, file.path))}
                          className="rounded px-1.5 py-0.5 text-[12px] text-fg-secondary hover:bg-app"
                        >
                          {t('review.unstage')}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={t('review.revert')}
                        title={t('review.revert')}
                        onClick={() =>
                          void runAction(() =>
                            window.workx.gitRevertFile(cwd, file.path, file.untracked),
                          )
                        }
                        className="flex size-6 items-center justify-center rounded text-fg-tertiary hover:bg-app hover:text-danger"
                      >
                        <RotateCcw className="size-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto py-1">
            {focused ? (
              diffLines(focused).map((line, index) => (
                <DiffRow key={`${index}-${line.text}`} line={line} />
              ))
            ) : selected ? (
              diff ? (
                gitDiffLines(diff).map((line, index) => (
                  <DiffRow key={`${index}-${line.text}`} line={line} />
                ))
              ) : (
                <div className="px-4 py-6 text-[13px] text-fg-tertiary">{t('review.noDiff')}</div>
              )
            ) : (
              <div className="px-4 py-6 text-[13px] text-fg-tertiary">{t('review.selectFile')}</div>
            )}
          </div>

          {notice ? (
            <div className="shrink-0 border-t border-line px-4 py-2 text-[12px] text-fg-secondary">
              {notice}
            </div>
          ) : null}

          <div className="shrink-0 border-t border-line p-3">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t('review.commitPlaceholder')}
              className="h-9 w-full rounded-lg border border-line bg-elevated px-3 text-[13px] outline-none focus:border-line-strong"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={busy || message.trim().length === 0}
                onClick={() => void commit()}
                className="h-8 rounded-lg bg-fg px-3 text-[13px] font-medium text-app hover:opacity-90 disabled:opacity-40"
              >
                {t('review.commit')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void push()}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:bg-hover disabled:opacity-40"
              >
                <ArrowUp className="size-3.5" strokeWidth={1.75} />
                {t('review.push')}
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
