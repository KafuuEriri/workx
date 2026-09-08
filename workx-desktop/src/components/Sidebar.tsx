import {
  AtSign,
  AudioLines,
  Bell,
  ChevronDown,
  CircleHelp,
  Clock,
  Folder,
  GitPullRequest,
  Link,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  SquarePen,
} from 'lucide-react';
import type { ComponentType, ReactNode, SVGProps } from 'react';

import { NAV_ITEMS, PROJECTS, RECENTS, type NavKey } from '../data/workspace';
import { cn } from '../lib/cn';
import { IconButton } from './IconButton';

const NAV_ICONS: Record<NavKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  'new-chat': SquarePen,
  'pull-requests': GitPullRequest,
  scheduled: Clock,
  plugins: AtSign,
  explore: MoreHorizontal,
};

const NAV_ACTION_SLOTS: Partial<Record<NavKey, ComponentType<SVGProps<SVGSVGElement>>>> = {
  'new-chat': Plus,
};

interface SidebarProps {
  activeNav: NavKey | null;
  onSelectNav: (key: NavKey) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ activeNav, onSelectNav, onOpenSettings }: SidebarProps) {
  return (
    <aside className="drag flex h-full w-[275px] shrink-0 flex-col border-r border-line-subtle bg-sidebar">
      <div className="h-11 shrink-0" />

      <div className="flex h-9 shrink-0 items-center gap-1 px-2">
        <button
          type="button"
          className="no-drag flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-[15px] font-semibold hover:bg-hover"
        >
          <span className="truncate">Workx</span>
          <ChevronDown className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={2} />
        </button>
        <div className="no-drag ml-auto flex items-center gap-0.5">
          <IconButton size="sm" aria-label="Search">
            <Search className="size-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton size="sm" aria-label="Notifications">
            <Bell className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      <nav className="no-drag mt-1 flex flex-col gap-px px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const ActionIcon = NAV_ACTION_SLOTS[item.key];
          const isActive = activeNav === item.key && item.key !== 'new-chat';
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectNav(item.key)}
              className={cn(
                'group flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px]',
                'transition-colors hover:bg-hover',
                isActive ? 'bg-active text-fg' : 'text-fg',
              )}
            >
              <Icon className="size-[18px] shrink-0 text-fg-secondary" strokeWidth={1.75} />
              <span className="truncate">{item.label}</span>
              {ActionIcon ? (
                <ActionIcon className="ml-auto size-4 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="no-drag mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        <SidebarSection label="Projects">
          {PROJECTS.map((project) => (
            <div key={project.id}>
              <button
                type="button"
                className={cn(
                  'flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] hover:bg-hover',
                  project.active ? 'text-fg' : 'text-fg',
                )}
              >
                <Folder className="size-[18px] shrink-0 text-fg-secondary" strokeWidth={1.75} />
                <span className="truncate">{project.name}</span>
              </button>

              {project.active && project.remoteUrl ? (
                <div className="group ml-[22px] flex h-[30px] items-center gap-1.5 rounded-lg bg-active px-2 text-[13px] text-fg-secondary">
                  <Link className="size-3.5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{project.remoteUrl}</span>
                  <Settings2
                    className="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    strokeWidth={1.75}
                  />
                </div>
              ) : null}

              {project.active
                ? project.threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      className="flex h-[30px] w-full items-center rounded-lg pl-[46px] pr-2 text-left text-[13px] text-fg-secondary hover:bg-hover"
                    >
                      <span className="truncate">{thread.title}</span>
                    </button>
                  ))
                : null}
            </div>
          ))}
          <button
            type="button"
            className="flex h-8 w-full items-center rounded-lg px-2.5 text-left text-[14px] text-fg-tertiary hover:bg-hover"
          >
            Show more
          </button>
        </SidebarSection>

        <SidebarSection label="Recents">
          {RECENTS.map((thread) => (
            <button
              key={thread.id}
              type="button"
              className={cn(
                'flex h-8 w-full items-center rounded-lg px-2.5 text-left text-[14px] hover:bg-hover',
                thread.muted ? 'text-fg-tertiary' : 'text-fg',
              )}
            >
              <span className="truncate">{thread.title}</span>
            </button>
          ))}
        </SidebarSection>
      </div>

      <div className="no-drag flex h-[52px] shrink-0 items-center gap-2 px-2.5">
        <div className="relative shrink-0">
          <div className="flex size-7 items-center justify-center rounded-full bg-fg text-[11px] font-medium text-fg-inverse">
            AE
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar bg-emerald-500" />
        </div>
        <span className="min-w-0 truncate text-[13px] text-fg-secondary">aegonxxxxxxx....</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-fg-secondary hover:bg-hover"
          >
            <AudioLines className="size-3.5" strokeWidth={1.75} />
            Voice
          </button>
          <IconButton size="sm" aria-label="Settings" onClick={onOpenSettings}>
            <Settings2 className="size-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton size="sm" aria-label="Help">
            <CircleHelp className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="group/section">
      <div className="flex h-8 items-center gap-1 px-2.5 pt-3">
        <span className="text-[13px] text-fg-tertiary">{label}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100">
          <IconButton size="sm" aria-label={`More ${label}`}>
            <MoreHorizontal className="size-3.5" strokeWidth={1.75} />
          </IconButton>
          <IconButton size="sm" aria-label={`Add to ${label}`}>
            <Plus className="size-3.5" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </section>
  );
}
