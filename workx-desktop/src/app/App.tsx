import { ArrowDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Composer } from '../components/Composer';
import { MessageList } from '../components/MessageList';
import { SettingsDialog } from '../components/SettingsDialog';
import { Sidebar, threadTitle } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { McpPanel, PluginsPanel, SkillsPanel } from '../components/WorkxPanels';
import type { NavKey } from '../data/workspace';
import {
  applyTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '../lib/theme';
import { useWorkx } from './useWorkx';

const PANEL_TITLES: Partial<Record<NavKey, string>> = {
  plugins: 'Plugins',
  skills: 'Skills',
  mcp: 'MCP servers',
};

export function App() {
  const workx = useWorkx();
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);
  const [activeNav, setActiveNav] = useState<NavKey | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    void window.workx?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ',' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (workx.status !== 'ready') {
      return;
    }
    if (activeNav === 'plugins') {
      void workx.refreshPlugins();
    } else if (activeNav === 'skills') {
      void workx.refreshSkills();
    } else if (activeNav === 'mcp') {
      void workx.refreshMcpServers();
    }
  }, [activeNav, workx.status, workx.refreshPlugins, workx.refreshSkills, workx.refreshMcpServers]);

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScrollDown(distance > 160);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [workx.transcript, updateScrollState]);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (workx.activeThread) {
      window.requestAnimationFrame(scrollToBottom);
    }
  }, [workx.activeThread, scrollToBottom]);

  const activeThread = workx.activeThread;
  const disabled = workx.status !== 'ready';
  const panel = PANEL_TITLES[activeNav ?? 'new-chat'] ? activeNav : null;
  const title =
    (panel ? PANEL_TITLES[panel] : null) ??
    (activeThread ? threadTitle(activeThread) : 'New chat');

  return (
    <div className="flex h-full w-full overflow-hidden bg-app text-fg">
      <Sidebar
        status={workx.status}
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        onOpenSettings={() => setSettingsOpen(true)}
        onNewChat={() => {
          setActiveNav('new-chat');
          void workx.newThread();
        }}
        projects={workx.projects}
        recents={workx.recents}
        activeThreadId={activeThread?.id ?? null}
        activeCwd={workx.cwd}
        onSelectThread={(id) => {
          setActiveNav(null);
          void workx.openThread(id);
        }}
        onSelectProject={(cwd) => {
          setActiveNav(null);
          workx.setActiveCwd(cwd);
        }}
        onAddProject={() => {
          void (async () => {
            const dir = await window.workx.pickFolder();
            if (!dir) {
              return;
            }
            setActiveNav(null);
            workx.setActiveCwd(dir);
            await workx.newThread();
          })();
        }}
        searchTerm={workx.searchTerm}
        searchResults={workx.searchResults}
        searching={workx.searching}
        onSearchTermChange={workx.setSearchTerm}
        onRenameThread={(id, name) => void workx.renameThread(id, name)}
        onArchiveThread={(id) => void workx.archiveThread(id)}
        onDeleteThread={(id) => void workx.deleteThread(id)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          subtitle={panel ? null : workx.cwd}
          status={workx.status}
        />

        {panel ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === 'plugins' ? (
              <PluginsPanel
                marketplaces={workx.pluginMarketplaces}
                errors={workx.pluginErrors}
                loading={workx.pluginsLoading}
                onRefresh={() => void workx.refreshPlugins()}
              />
            ) : null}
            {panel === 'skills' ? (
              <SkillsPanel
                skills={workx.skills}
                errors={workx.skillErrors}
                loading={workx.skillsLoading}
                onRefresh={() => void workx.refreshSkills()}
              />
            ) : null}
            {panel === 'mcp' ? (
              <McpPanel
                servers={workx.mcpServers}
                loading={workx.mcpLoading}
                onRefresh={() => void workx.refreshMcpServers()}
              />
            ) : null}
          </div>
        ) : (
          <>
            <div className="relative min-h-0 flex-1">
              <div
                ref={scrollRef}
                onScroll={updateScrollState}
                className="h-full overflow-y-auto"
              >
                <MessageList
                  entries={workx.transcript}
                  running={workx.running}
                  error={
                    workx.error ??
                    (workx.status === 'error' ? workx.statusMessage : null) ??
                    (workx.status === 'stopped'
                      ? 'The Workx app-server stopped. Restart Workx to reconnect.'
                      : null)
                  }
                  warnings={workx.warnings}
                  approvals={workx.approvals}
                  cwd={workx.cwd}
                  onResolveApproval={(id, decision) => void workx.resolveApproval(id, decision)}
                  onDismissError={workx.dismissError}
                />
              </div>

              {showScrollDown ? (
                <button
                  type="button"
                  onClick={scrollToBottom}
                  aria-label="Scroll to bottom"
                  className="absolute bottom-4 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-elevated text-fg-secondary shadow-lg hover:text-fg"
                >
                  <ArrowDown className="size-4" strokeWidth={1.75} />
                </button>
              ) : null}
            </div>

            <Composer
              models={workx.models}
              selectedModelId={workx.selectedModelId}
              onModelChange={workx.selectModel}
              permission={workx.permission}
              onPermissionChange={workx.setPermission}
              running={workx.running}
              disabled={disabled}
              onSubmit={(text) => {
                void workx.sendMessage(text);
                window.requestAnimationFrame(scrollToBottom);
              }}
              onInterrupt={() => void workx.interrupt()}
            />
          </>
        )}
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        models={workx.models}
        selectedModelId={workx.selectedModelId}
        onModelChange={workx.selectModel}
        selectedEffort={workx.selectedEffort}
        onEffortChange={workx.setEffort}
        theme={theme}
        onThemeChange={setTheme}
      />
    </div>
  );
}
