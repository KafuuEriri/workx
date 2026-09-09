import { Folder, MessageSquare, Pencil } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ProjectView } from '../app/useWorkx';
import { useI18n } from '../lib/i18n';

const CARD_GAP = 8;
const VIEWPORT_MARGIN = 8;

function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+(?=\/|$)/u, '~');
}

interface ProjectHoverCardProps {
  project: ProjectView;
  anchor: DOMRect;
  onEdit: () => void;
  onRename: (name: string) => void;
  onOpenSource: (path: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function ProjectHoverCard({
  project,
  anchor,
  onEdit,
  onRename,
  onOpenSource,
  onMouseEnter,
  onMouseLeave,
}: ProjectHoverCardProps) {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [position, setPosition] = useState({
    left: anchor.right + CARD_GAP,
    top: anchor.top,
  });

  useEffect(() => {
    setDraft(project.name);
  }, [project.name]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    const { width, height } = card.getBoundingClientRect();
    setPosition({
      left: Math.max(
        VIEWPORT_MARGIN,
        Math.min(anchor.right + CARD_GAP, window.innerWidth - width - VIEWPORT_MARGIN),
      ),
      top: Math.max(
        VIEWPORT_MARGIN,
        Math.min(anchor.top, window.innerHeight - height - VIEWPORT_MARGIN),
      ),
    });
  }, [anchor]);

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== project.name) {
      onRename(next);
    } else {
      setDraft(project.name);
    }
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={t('sidebar.projectDetails', { name: project.name })}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ left: position.left, top: position.top }}
      className="fixed z-50 flex w-[min(21rem,calc(100vw-16px))] min-w-72 flex-col gap-1.5 rounded-xl border border-line bg-elevated p-2 text-fg shadow-xl"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1">
          <Folder className="size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
          {renaming ? (
            <input
              autoFocus
              aria-label={t('sidebar.projectName')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setDraft(project.name);
                  setRenaming(false);
                }
              }}
              className="min-w-0 flex-1 rounded-md bg-transparent text-base leading-6 font-medium outline-none ring-1 ring-line-strong focus:ring-info"
            />
          ) : (
            <button
              type="button"
              title={project.name}
              onClick={() => {
                setDraft(project.name);
                setRenaming(true);
              }}
              className="min-w-0 flex-1 truncate rounded-md text-left text-base leading-6 font-medium hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
            >
              {project.name}
            </button>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm leading-5 text-fg-secondary">
          <MessageSquare className="size-3.5 shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 truncate">
            {t(
              project.threads.length === 1 ? 'sidebar.chatCountOne' : 'sidebar.chatCount',
              { count: project.threads.length },
            )}
          </span>
        </div>
      </div>

      {project.roots.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-px border-t border-line-subtle pt-1.5">
          {project.roots.map((root) => {
            const short = shortenPath(root);
            return (
              <button
                key={root}
                type="button"
                title={short}
                aria-label={t('sidebar.openPath', { path: short })}
                onClick={() => onOpenSource(root)}
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm leading-5 text-fg-secondary hover:bg-hover hover:text-fg"
              >
                <Folder className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">{short}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-px border-t border-line-subtle pt-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm leading-5 hover:bg-hover"
        >
          <Pencil className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate">{t('sidebar.editProject')}</span>
        </button>
      </div>
    </div>
  );
}
