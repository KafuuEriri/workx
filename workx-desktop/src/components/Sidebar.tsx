import {
  Archive,
  ArrowUpDown,
  AudioLines,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Folder,
  FolderOpen,
  Layers,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Plug,
  Plus,
  Puzzle,
  Search,
  Settings2,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';

import type { ProjectView } from '../app/useWorkx';
import type { Thread } from '@protocol/v2/Thread';
import { NAV_ITEMS, type NavKey } from '../data/workspace';
import { cn } from '../lib/cn';
import { IconButton } from './IconButton';
import { ProjectHoverCard } from './ProjectHoverCard';
import type { ConnectionStatus } from './TopBar';

const NAV_ICONS: Record<NavKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  'new-chat': SquarePen,
  plugins: Puzzle,
  skills: Sparkles,
  mcp: Plug,
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
  connecting: 'bg-amber-500',
  ready: 'bg-emerald-500',
  error: 'bg-danger',
  stopped: 'bg-fg-tertiary',
};

const PROJECT_LIMIT = 5;
const PROJECT_THREAD_LIMIT = 5;

type ProjectOrganize = 'project' | 'list';
type ProjectSort = 'manual' | 'updated';

interface SidebarProps {
  status: ConnectionStatus;
  activeNav: NavKey | null;
  onSelectNav: (key: NavKey) => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  projects: ProjectView[];
  recents: Thread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onSelectProject: (projectId: string) => void;
  onNewChatInProject: (projectId: string) => void;
  onAddProject: () => void;
  onArchiveProjectChats: (project: ProjectView) => void;
  onEditProject: (project: ProjectView) => void;
  onRenameProject: (project: ProjectView, name: string) => void;
  onRemoveProject: (project: ProjectView) => void;
  searchTerm: string;
  searchResults: Thread[];
  searching: boolean;
  onSearchTermChange: (term: string) => void;
  onRenameThread: (id: string, name: string) => void;
  onArchiveThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
}

export function threadTitle(thread: Thread): string {
  const name = thread.name?.trim();
  if (name) {
    return name;
  }
  const preview = thread.preview?.trim();
  return preview ? preview : 'New chat';
}

export function Sidebar({
  status,
  activeNav,
  onSelectNav,
  onOpenSettings,
  onNewChat,
  projects,
  recents,
  activeThreadId,
  onSelectThread,
  onSelectProject,
  onNewChatInProject,
  onAddProject,
  onArchiveProjectChats,
  onEditProject,
  onRenameProject,
  onRemoveProject,
  searchTerm,
  searchResults,
  searching,
  onSearchTermChange,
  onRenameThread,
  onArchiveThread,
  onDeleteThread,
}: SidebarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [projectsMenuOpen, setProjectsMenuOpen] = useState(false);
  const [organize, setOrganize] = useState<ProjectOrganize>('project');
  const [projectSort, setProjectSort] = useState<ProjectSort>('manual');

  const searching_ = searchOpen || searchTerm.trim().length > 0;

  useEffect(() => {
    if (!activeThreadId) {
      return;
    }
    const project = projects.find((candidate) =>
      candidate.threads.some((thread) => thread.id === activeThreadId),
    );
    if (project) {
      setExpandedProjects(new Set([project.id]));
    }
  }, [activeThreadId, projects]);

  const closeSearch = () => {
    setSearchOpen(false);
    onSearchTermChange('');
  };

  const toggleProject = (project: ProjectView) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(project.id)) {
        next.delete(project.id);
      } else {
        next.add(project.id);
      }
      return next;
    });
    onSelectProject(project.id);
  };

  const renderThread = (thread: Thread, indent = false) => (
    <ThreadRow
      key={thread.id}
      thread={thread}
      indent={indent}
      active={activeThreadId === thread.id}
      renaming={renamingId === thread.id}
      onSelect={() => onSelectThread(thread.id)}
      onStartRename={() => setRenamingId(thread.id)}
      onRename={(name) => {
        setRenamingId(null);
        if (name.trim()) {
          onRenameThread(thread.id, name.trim());
        }
      }}
      onCancelRename={() => setRenamingId(null)}
      onArchive={() => onArchiveThread(thread.id)}
      onDelete={() => onDeleteThread(thread.id)}
    />
  );

  const orderedProjects =
    projectSort === 'updated'
      ? [...projects].sort((a, b) => (b.recencyAt ?? -1) - (a.recencyAt ?? -1))
      : projects;
  const visibleProjects = showAllProjects
    ? orderedProjects
    : orderedProjects.slice(0, PROJECT_LIMIT);
  const flatThreads = [...projects.flatMap((project) => project.threads), ...recents].sort(
    (a, b) => (b.recencyAt ?? 0) - (a.recencyAt ?? 0),
  );

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
          <IconButton
            size="sm"
            aria-label="Search"
            onClick={() => setSearchOpen((value) => !value)}
          >
            <Search className="size-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton size="sm" aria-label="Notifications">
            <Bell className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      {searchOpen ? (
        <div className="no-drag mx-2 mt-1 flex h-8 items-center gap-2 rounded-lg border border-line bg-app px-2.5">
          <Search className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
          <input
            autoFocus
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                closeSearch();
              }
            }}
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-tertiary"
          />
          <button type="button" onClick={closeSearch} aria-label="Close search">
            <X className="size-3.5 text-fg-tertiary hover:text-fg" strokeWidth={1.75} />
          </button>
        </div>
      ) : null}

      {!searching_ ? (
        <nav className="no-drag mt-1 flex flex-col gap-px px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = NAV_ICONS[item.key];
            const isActive = activeNav === item.key && item.key !== 'new-chat';
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === 'new-chat') {
                    onNewChat();
                  } else {
                    onSelectNav(item.key);
                  }
                }}
                className={cn(
                  'flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] transition-colors hover:bg-hover',
                  isActive ? 'bg-active text-fg' : 'text-fg',
                )}
              >
                <Icon className="size-[18px] shrink-0 text-fg-secondary" strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
                {item.key === 'new-chat' ? (
                  <Plus className="ml-auto size-4 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
                ) : null}
              </button>
            );
          })}
        </nav>
      ) : null}

      <div className="no-drag mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        {searching_ ? (
          <SidebarSection label="Search results">
            {searching ? (
              <p className="px-2.5 py-1 text-[13px] text-fg-tertiary">Searching…</p>
            ) : null}
            {!searching && searchTerm.trim() && searchResults.length === 0 ? (
              <p className="px-2.5 py-1 text-[13px] text-fg-tertiary">No matching chats</p>
            ) : null}
            {searchResults.map((thread) => renderThread(thread))}
          </SidebarSection>
        ) : (
          <>
            <div className="relative">
              {organize === 'list' ? (
                <SidebarSection
                  label="Chats"
                  onAdd={onNewChat}
                  onMore={() => setProjectsMenuOpen((value) => !value)}
                >
                  {flatThreads.map((thread) => renderThread(thread))}
                  {flatThreads.length === 0 ? (
                    <p className="px-2.5 py-1 text-[13px] text-fg-tertiary">No chats yet</p>
                  ) : null}
                </SidebarSection>
              ) : (
                <SidebarSection
                  label="Projects"
                  onAdd={onAddProject}
                  onMore={() => setProjectsMenuOpen((value) => !value)}
                >
                  {visibleProjects.map((project) => {
                    const expanded = expandedProjects.has(project.id);
                    return (
                      <div key={project.id}>
                        <ProjectRow
                          project={project}
                          onToggle={() => toggleProject(project)}
                          onNewChat={() => onNewChatInProject(project.id)}
                          onArchiveChats={() => onArchiveProjectChats(project)}
                          onEdit={() => onEditProject(project)}
                          onRename={(name) => onRenameProject(project, name)}
                          onRemove={() => onRemoveProject(project)}
                        />

                        {expanded
                          ? project.threads
                              .slice(0, PROJECT_THREAD_LIMIT)
                              .map((thread) => renderThread(thread, true))
                          : null}
                      </div>
                    );
                  })}
                  {projects.length === 0 ? (
                    <p className="px-2.5 py-1 text-[13px] text-fg-tertiary">No projects yet</p>
                  ) : null}
                  {projects.length > PROJECT_LIMIT ? (
                    <button
                      type="button"
                      onClick={() => setShowAllProjects((value) => !value)}
                      className="flex h-[30px] w-full items-center rounded-lg px-2.5 text-left text-[14px] text-fg-tertiary hover:bg-hover"
                    >
                      {showAllProjects ? 'Show less' : 'Show more'}
                    </button>
                  ) : null}
                </SidebarSection>
              )}

              {projectsMenuOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onMouseDown={() => setProjectsMenuOpen(false)}
                  />
                  <div className="absolute right-2 top-9 z-50 min-w-[200px] rounded-xl border border-line bg-elevated p-1 shadow-xl">
                    <MenuSubmenu icon={Layers} label="Organize sidebar">
                      <MenuRadio
                        label="By project"
                        checked={organize === 'project'}
                        onClick={() => {
                          setOrganize('project');
                          setProjectsMenuOpen(false);
                        }}
                      />
                      <MenuRadio
                        label="In one list"
                        checked={organize === 'list'}
                        onClick={() => {
                          setOrganize('list');
                          setProjectsMenuOpen(false);
                        }}
                      />
                    </MenuSubmenu>
                    <MenuSubmenu icon={ArrowUpDown} label="Sort chats by">
                      <MenuRadio
                        label="Manual order"
                        checked={projectSort === 'manual'}
                        onClick={() => {
                          setProjectSort('manual');
                          setProjectsMenuOpen(false);
                        }}
                      />
                      <MenuRadio
                        label="Last updated"
                        checked={projectSort === 'updated'}
                        onClick={() => {
                          setProjectSort('updated');
                          setProjectsMenuOpen(false);
                        }}
                      />
                    </MenuSubmenu>
                  </div>
                </>
              ) : null}
            </div>

            {organize === 'project' ? (
              <SidebarSection label="Recents" onAdd={onNewChat}>
                {recents.map((thread) => renderThread(thread))}
                {recents.length === 0 ? (
                  <p className="px-2.5 py-1 text-[13px] text-fg-tertiary">No chats yet</p>
                ) : null}
              </SidebarSection>
            ) : null}
          </>
        )}
      </div>

      <div className="no-drag flex h-[52px] shrink-0 items-center gap-2 px-2.5">
        <div className="relative shrink-0">
          <div className="flex size-7 items-center justify-center rounded-full bg-fg text-[11px] font-medium text-fg-inverse">
            WX
          </div>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-sidebar',
              STATUS_DOT[status],
            )}
          />
        </div>
        <span className="min-w-0 truncate text-[13px] text-fg-secondary">
          {status === 'ready' ? 'app-server connected' : status}
        </span>
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

function ProjectRow({
  project,
  onToggle,
  onNewChat,
  onArchiveChats,
  onEdit,
  onRename,
  onRemove,
}: {
  project: ProjectView;
  onToggle: () => void;
  onNewChat: () => void;
  onArchiveChats: () => void;
  onEdit: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelOpen = () => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  useEffect(
    () => () => {
      if (openTimer.current !== null) {
        window.clearTimeout(openTimer.current);
      }
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (menuOpen) {
      setHoverOpen(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!hoverOpen) {
      return;
    }
    const close = () => setHoverOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [hoverOpen]);

  const scheduleOpen = () => {
    cancelClose();
    if (hoverOpen || openTimer.current !== null) {
      return;
    }
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      if (rowRef.current) {
        setAnchor(rowRef.current.getBoundingClientRect());
        setHoverOpen(true);
      }
    }, 300);
  };

  const scheduleClose = () => {
    cancelOpen();
    if (closeTimer.current !== null) {
      return;
    }
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setHoverOpen(false);
    }, 180);
  };

  const closeHover = () => {
    cancelOpen();
    cancelClose();
    setHoverOpen(false);
  };

  return (
    <div
      ref={rowRef}
      className="group/row relative"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex h-[30px] w-full items-center gap-2.5 rounded-lg px-2.5 pr-[58px] text-left text-[14px] hover:bg-hover"
      >
        <Folder className="size-[18px] shrink-0 text-fg-secondary" strokeWidth={1.75} />
        <span className="truncate">{project.name}</span>
      </button>
      <div
        className={cn(
          'absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100',
          menuOpen && 'opacity-100',
        )}
      >
        <IconButton
          size="sm"
          aria-label={`New chat in ${project.name}`}
          onClick={() => {
            closeHover();
            onNewChat();
          }}
        >
          <Plus className="size-3.5" strokeWidth={1.75} />
        </IconButton>
        <IconButton
          size="sm"
          aria-label="Project actions"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <MoreHorizontal className="size-3.5" strokeWidth={1.75} />
        </IconButton>
      </div>
      {hoverOpen && anchor ? (
        <ProjectHoverCard
          project={project}
          anchor={anchor}
          onEdit={() => {
            closeHover();
            onEdit();
          }}
          onRename={onRename}
          onOpenSource={(path) => void window.workx.openPath(path)}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      ) : null}
      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setMenuOpen(false)} />
          <div className="absolute right-1 top-[28px] z-50 min-w-[190px] rounded-xl border border-line bg-elevated p-1 shadow-xl">
            <MenuAction
              icon={MessageSquarePlus}
              label="New chat"
              onClick={() => {
                setMenuOpen(false);
                onNewChat();
              }}
            />
            <MenuAction
              icon={FolderOpen}
              label="Reveal in Finder"
              onClick={() => {
                setMenuOpen(false);
                if (project.primaryRoot) {
                  void window.workx.openPath(project.primaryRoot);
                }
              }}
            />
            {project.threads.length > 0 ? (
              <MenuAction
                icon={Archive}
                label="Archive chats"
                onClick={() => {
                  setMenuOpen(false);
                  onArchiveChats();
                }}
              />
            ) : null}
            <MenuAction
              icon={Pencil}
              label="Edit"
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
            />
            <MenuAction
              icon={Trash2}
              label="Remove project"
              danger
              onClick={() => {
                setMenuOpen(false);
                onRemove();
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ThreadRow({
  thread,
  indent,
  active,
  renaming,
  onSelect,
  onStartRename,
  onRename,
  onCancelRename,
  onArchive,
  onDelete,
}: {
  thread: Thread;
  indent: boolean;
  active: boolean;
  renaming: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(threadTitle(thread));

  if (renaming) {
    return (
      <div className={cn('pr-1', indent ? 'pl-[38px]' : 'pl-1')}>
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => onRename(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onRename(draft);
            } else if (event.key === 'Escape') {
              onCancelRename();
            }
          }}
          className="h-[30px] w-full rounded-lg border border-line bg-app px-2 text-[13px] outline-none"
        />
      </div>
    );
  }

  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex h-[30px] w-full items-center rounded-lg pr-8 text-left text-[13px] text-fg-secondary hover:bg-hover',
          indent ? 'pl-[38px]' : 'pl-2.5',
          active && 'bg-active text-fg',
        )}
      >
        <span className="truncate">{threadTitle(thread)}</span>
      </button>
      <div
        className={cn(
          'absolute right-1 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover/row:opacity-100',
          menuOpen && 'opacity-100',
        )}
      >
        <IconButton
          size="sm"
          aria-label="Chat actions"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <MoreHorizontal className="size-3.5" strokeWidth={1.75} />
        </IconButton>
      </div>
      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setMenuOpen(false)} />
          <div className="absolute right-1 top-[28px] z-50 min-w-[160px] rounded-xl border border-line bg-elevated p-1 shadow-xl">
            <MenuAction
              icon={Pencil}
              label="Rename"
              onClick={() => {
                setMenuOpen(false);
                setDraft(threadTitle(thread));
                onStartRename();
              }}
            />
            <MenuAction
              icon={Archive}
              label="Archive"
              onClick={() => {
                setMenuOpen(false);
                onArchive();
              }}
            />
            <MenuAction
              icon={Trash2}
              label="Delete"
              danger
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuAction({
  icon: Icon,
  label,
  danger = false,
  onClick,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-hover',
        danger ? 'text-danger' : 'text-fg',
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
      {label}
    </button>
  );
}

function MenuSubmenu({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-fg hover:bg-hover"
      >
        <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="flex-1">{label}</span>
        <ChevronRight
          className={cn('size-3.5 shrink-0 text-fg-tertiary transition-transform', open && 'rotate-90')}
          strokeWidth={1.75}
        />
      </button>
      {open ? <div className="mt-px flex flex-col gap-px pl-5">{children}</div> : null}
    </div>
  );
}

function MenuRadio({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-fg hover:bg-hover"
    >
      <Check
        className={cn('size-3.5 shrink-0', checked ? 'opacity-100' : 'opacity-0')}
        strokeWidth={2}
      />
      {label}
    </button>
  );
}

function SidebarSection({
  label,
  children,
  onAdd,
  onMore,
}: {
  label: string;
  children: ReactNode;
  onAdd?: () => void;
  onMore?: () => void;
}) {
  return (
    <section className="group/section">
      <div className="flex h-8 items-center gap-1 px-2.5 pt-3">
        <span className="text-[13px] text-fg-tertiary">{label}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100">
          {onMore ? (
            <IconButton size="sm" aria-label={`More ${label}`} onClick={onMore}>
              <MoreHorizontal className="size-3.5" strokeWidth={1.75} />
            </IconButton>
          ) : null}
          {onAdd ? (
            <IconButton size="sm" aria-label={`Add to ${label}`} onClick={onAdd}>
              <Plus className="size-3.5" strokeWidth={1.75} />
            </IconButton>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </section>
  );
}
