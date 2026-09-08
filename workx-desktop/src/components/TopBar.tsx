import { Columns2, FileText, MoreHorizontal, PanelRight, Share2 } from 'lucide-react';

import { IconButton } from './IconButton';

export function TopBar() {
  return (
    <header className="drag flex h-[52px] shrink-0 items-center gap-2 px-3">
      <button
        type="button"
        className="no-drag flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-fg-secondary hover:bg-hover"
      >
        <FileText className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="max-w-[460px] truncate">
          https://github.com/RonanXiao/workx/issues/...
        </span>
        <MoreHorizontal className="size-3.5 shrink-0" strokeWidth={1.75} />
      </button>

      <div className="no-drag ml-auto flex items-center gap-0.5">
        <button
          type="button"
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-fg-secondary hover:bg-hover"
        >
          <Share2 className="size-3.5" strokeWidth={1.75} />
          Share
        </button>
        <IconButton size="sm" aria-label="Toggle split view">
          <Columns2 className="size-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton size="sm" aria-label="Toggle side panel">
          <PanelRight className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>
    </header>
  );
}
