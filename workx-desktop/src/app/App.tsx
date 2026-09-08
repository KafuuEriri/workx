import { ArrowDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Composer } from '../components/Composer';
import { MessageList } from '../components/MessageList';
import { SettingsDialog } from '../components/SettingsDialog';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import {
  CONVERSATION,
  MODEL_OPTIONS,
  PERMISSION_MODES,
  type Message,
  type NavKey,
} from '../data/workspace';
import {
  applyTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '../lib/theme';

export function App() {
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);
  const [activeNav, setActiveNav] = useState<NavKey | null>(null);
  const [messages, setMessages] = useState<Message[]>(CONVERSATION);
  const [model, setModel] = useState(MODEL_OPTIONS[0]);
  const [permission, setPermission] = useState(
    PERMISSION_MODES.find((mode) => mode.id === 'full-access') ?? PERMISSION_MODES[0],
  );
  const [provider, setProvider] = useState('deepseek');
  const [reasoning, setReasoning] = useState('Default');
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
  }, [messages, updateScrollState]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  };

  const handleSubmit = (text: string) => {
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', text },
    ]);
    window.requestAnimationFrame(scrollToBottom);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-app text-fg">
      <Sidebar
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="h-full overflow-y-auto"
          >
            <MessageList messages={messages} />
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
          model={model}
          onModelChange={setModel}
          permission={permission}
          onPermissionChange={setPermission}
          onSubmit={handleSubmit}
        />
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        provider={provider}
        onProviderChange={setProvider}
        model={model}
        onModelChange={setModel}
        reasoning={reasoning}
        onReasoningChange={setReasoning}
        theme={theme}
        onThemeChange={setTheme}
      />
    </div>
  );
}
