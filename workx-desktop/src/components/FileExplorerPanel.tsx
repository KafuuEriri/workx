import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Folder,
  FolderOpen,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import type { DirectoryEntry } from '../preload';
import { IconButton } from './IconButton';
import { useI18n } from '../lib/i18n';

interface FileExplorerPanelProps {
  roots: string[];
  onOpenPath: (path: string) => void;
  onClose: () => void;
}

function basename(target: string): string {
  const parts = target.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? target;
}

export function FileExplorerPanel({ roots, onOpenPath, onClose }: FileExplorerPanelProps) {
  const { t } = useI18n();
  const rootsKey = roots.join('\n');
  const [cache, setCache] = useState<Record<string, DirectoryEntry[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryEntry[] | null>(null);
  const [searching, setSearching] = useState(false);

  const loadDirectory = useCallback(async (target: string) => {
    setLoading((current) => ({ ...current, [target]: true }));
    try {
      const entries = await window.workx.listDirectory(target);
      setCache((current) => ({ ...current, [target]: entries }));
    } finally {
      setLoading((current) => {
        const next = { ...current };
        delete next[target];
        return next;
      });
    }
  }, []);

  useEffect(() => {
    setCache({});
    setExpanded({});
    setQuery('');
    setResults(null);
    for (const root of roots) {
      void loadDirectory(root);
    }
    // Reset the tree only when the workspace roots themselves change.
  }, [rootsKey, loadDirectory]);

  useEffect(() => {
    const needle = query.trim();
    if (!needle) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    let active = true;
    const handle = window.setTimeout(() => {
      void window.workx
        .searchDirectory(roots, needle)
        .then((entries) => {
          if (active) {
            setResults(entries);
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false);
          }
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query, rootsKey, roots]);

  const toggleDirectory = (entry: DirectoryEntry) => {
    setExpanded((current) => ({ ...current, [entry.path]: !current[entry.path] }));
    if (!cache[entry.path] && !loading[entry.path]) {
      void loadDirectory(entry.path);
    }
  };

  const revealResult = (entry: DirectoryEntry) => {
    if (!entry.isDirectory) {
      onOpenPath(entry.path);
      return;
    }
    setQuery('');
    setExpanded((current) => ({ ...current, [entry.path]: true }));
    void loadDirectory(entry.path);
  };

  const renderEntries = (parent: string, depth: number): ReactNode => {
    const entries = cache[parent];
    if (!entries) {
      return loading[parent] ? (
        <p
          style={{ paddingLeft: depth * 12 + 8 }}
          className="py-1 text-[12px] text-fg-tertiary"
        >
          {t('explorer.loading')}
        </p>
      ) : null;
    }
    if (entries.length === 0) {
      return depth === 0 ? (
        <p style={{ paddingLeft: depth * 12 + 8 }} className="py-1 text-[12px] text-fg-tertiary">
          {t('explorer.empty')}
        </p>
      ) : null;
    }
    return entries.map((entry) => (
      <div key={entry.path}>
        <button
          type="button"
          onClick={() => (entry.isDirectory ? toggleDirectory(entry) : onOpenPath(entry.path))}
          style={{ paddingLeft: depth * 12 + 6 }}
          title={entry.path}
          className="flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-[12.5px] text-fg-secondary hover:bg-hover"
        >
          {entry.isDirectory ? (
            expanded[entry.path] ? (
              <ChevronDown className="size-3 shrink-0" strokeWidth={1.75} />
            ) : (
              <ChevronRight className="size-3 shrink-0" strokeWidth={1.75} />
            )
          ) : (
            <span className="w-3 shrink-0" />
          )}
          {entry.isDirectory ? (
            expanded[entry.path] ? (
              <FolderOpen className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
            ) : (
              <Folder className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
            )
          ) : (
            <FileIcon className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
          )}
          <span className="truncate">{entry.name}</span>
        </button>
        {entry.isDirectory && expanded[entry.path] ? renderEntries(entry.path, depth + 1) : null}
      </div>
    ));
  };

  const title = roots.length === 1 ? basename(roots[0]) : t('explorer.title');

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-line bg-app">
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-line px-3">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={roots[0]}>
          {title}
        </span>
        <button
          type="button"
          disabled={roots.length === 0}
          onClick={() => roots.forEach((root) => onOpenPath(root))}
          className="h-7 shrink-0 rounded-full border border-line px-2.5 text-[12px] text-fg-secondary hover:bg-hover disabled:opacity-40"
        >
          {t('explorer.open')}
        </button>
        <IconButton size="sm" aria-label={t('common.close')} onClick={onClose}>
          <X className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>

      <div className="shrink-0 border-b border-line p-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-tertiary"
            strokeWidth={1.75}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('explorer.filter')}
            className="h-8 w-full rounded-lg border border-line bg-elevated pl-7 pr-2 text-[12.5px] outline-none focus:border-line-strong"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {results !== null ? (
          results.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-fg-tertiary">
              {searching ? t('explorer.loading') : t('explorer.noResults')}
            </p>
          ) : (
            results.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => revealResult(entry)}
                title={entry.path}
                className="flex w-full flex-col rounded-md px-3 py-1 text-left hover:bg-hover"
              >
                <span className="flex items-center gap-1.5 text-[12.5px] text-fg-secondary">
                  {entry.isDirectory ? (
                    <Folder className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
                  ) : (
                    <FileIcon className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
                  )}
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="truncate pl-5 text-[11px] text-fg-tertiary">{entry.path}</span>
              </button>
            ))
          )
        ) : roots.length === 0 ? (
          <p className="px-3 py-2 text-[12px] leading-snug text-fg-tertiary">
            {t('explorer.noProject')}
          </p>
        ) : (
          roots.map((root) => (
            <div key={root}>
              <div className="flex items-center gap-1 px-2 py-1 text-[11px] uppercase tracking-wide text-fg-tertiary">
                <Folder className="size-3 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{basename(root)}</span>
              </div>
              {renderEntries(root, 0)}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
