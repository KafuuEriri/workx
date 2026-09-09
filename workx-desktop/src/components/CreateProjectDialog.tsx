import { Folder, FolderPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '../lib/cn';
import { useI18n } from '../lib/i18n';
import { IconButton } from './IconButton';

interface CreateProjectDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialName?: string;
  initialRoots?: string[];
  onClose: () => void;
  onSubmit: (name: string, roots: string[]) => Promise<void>;
  onPickFolder: () => Promise<string | null>;
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function CreateProjectDialog({
  open,
  mode,
  initialName = '',
  initialRoots = [],
  onClose,
  onSubmit,
  onPickFolder,
}: CreateProjectDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [roots, setRoots] = useState<string[]>(initialRoots);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(initialName);
    setRoots(initialRoots);
    setError(null);
    setSubmitting(false);
  }, [open, initialName, initialRoots]);

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

  const addFolder = async () => {
    const picked = await onPickFolder();
    if (!picked) {
      return;
    }
    setRoots((current) => (current.includes(picked) ? current : [...current, picked]));
  };

  const makePrimary = (path: string) => {
    setRoots((current) => [path, ...current.filter((candidate) => candidate !== path)]);
  };

  const submit = async () => {
    if (roots.length === 0) {
      setError(t('project.noFolders'));
      return;
    }
    const resolvedName = name.trim() || basename(roots[0]);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(resolvedName, roots);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'create' ? t('project.createTitle') : t('project.editTitle')}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-[520px] max-w-full rounded-2xl border border-line bg-elevated p-5 shadow-2xl"
      >
        <div className="flex items-center">
          <h2 className="text-[17px] font-semibold">
            {mode === 'create' ? t('project.createTitle') : t('project.editTitle')}
          </h2>
          <IconButton
            size="sm"
            aria-label={t('common.close')}
            className="ml-auto"
            onClick={onClose}
          >
            <X className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className="mt-4 flex h-10 items-center gap-2.5 rounded-xl border border-line px-3">
          <Folder className="size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void submit();
              }
            }}
            placeholder={t('project.namePlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-tertiary"
          />
        </div>

        <p className="mt-4 text-[13px] text-fg-secondary">{t('project.sourceFolders')}</p>

        <div className="mt-2 overflow-hidden rounded-xl border border-line">
          {roots.map((root, index) => (
            <div
              key={root}
              className={cn(
                'group/root flex h-11 items-center gap-2.5 px-3',
                index > 0 && 'border-t border-line-subtle',
              )}
            >
              <Folder className="size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate text-[14px]">{basename(root)}</span>
              {index === 0 ? (
                <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-fg-tertiary">
                  {t('common.primary')}
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={t('project.makePrimaryAria', { name: basename(root) })}
                  onClick={() => makePrimary(root)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[12px] text-fg-secondary opacity-0 hover:bg-hover hover:text-fg group-hover/root:opacity-100 focus:opacity-100"
                >
                  {t('common.makePrimary')}
                </button>
              )}
              <IconButton
                size="sm"
                aria-label={t('project.removeFolder', { name: basename(root) })}
                className="shrink-0"
                onClick={() => setRoots((current) => current.filter((path) => path !== root))}
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </IconButton>
            </div>
          ))}

          <button
            type="button"
            onClick={() => void addFolder()}
            className={cn(
              'flex h-11 w-full items-center gap-2.5 px-3 text-left text-[14px] text-fg-secondary hover:bg-hover',
              roots.length > 0 && 'border-t border-line-subtle',
            )}
          >
            <FolderPlus className="size-4 shrink-0" strokeWidth={1.75} />
            <span>
              {roots.length === 0 ? t('project.addFolders') : t('project.addFolder')}
            </span>
          </button>
        </div>

        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center rounded-lg px-3 text-[14px] text-fg-secondary hover:bg-hover"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="flex h-9 items-center rounded-lg bg-send px-3.5 text-[14px] font-medium text-send-fg hover:opacity-90 disabled:opacity-60"
          >
            {mode === 'create' ? t('project.createAction') : t('project.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
