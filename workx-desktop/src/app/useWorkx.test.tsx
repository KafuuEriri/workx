// @vitest-environment jsdom
//
// `thread/resume` returns the stored thread summary and the settings the resumed session
// actually uses. The summary lags behind a resume that applied overrides, so the composer
// must read the session settings. These tests pin that behavior through the real hook.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Thread } from '@protocol/v2/Thread';
import { I18nProvider, LANGUAGE_STORAGE_KEY, translate } from '../lib/i18n';
import type { WorkxBridge } from '../preload';
import { useWorkx, type WorkxController } from './useWorkx';

const THREAD_ID = '01a0a7e5-7354-7661-9386-8dcacd8b666c';
const CWD = '/tmp/workx-desktop-resume-test';

interface ResumeScenario {
  /** Provider stored on the thread summary. A resume that applied overrides leaves it stale. */
  threadProvider: string;
  /** Provider the resumed session reports. This is the value the session actually uses. */
  sessionProvider: string;
}

function threadSummary(provider: string): Thread {
  return {
    id: THREAD_ID,
    projectId: null,
    cwd: CWD,
    model: `${provider}-stored-model`,
    modelProvider: provider,
    reasoningEffort: null,
    turns: [],
  } as unknown as Thread;
}

function createBridge(scenario: ResumeScenario): WorkxBridge {
  // Mirrors the config file the app-server would hand back through `config/read`.
  const config = { provider: 'alpha', model: 'alpha-catalog-model' };
  const request = async (method: string, params?: unknown): Promise<unknown> => {
    switch (method) {
      case 'config/read':
        return {
          config: {
            model: config.model,
            model_provider: config.provider,
            model_providers: { alpha: { name: 'Alpha' }, beta: { name: 'Beta' } },
          },
        };
      case 'config/batchWrite': {
        const { edits } = params as { edits: { keyPath: string; value: unknown }[] };
        for (const edit of edits) {
          if (edit.keyPath === 'model_provider') {
            config.provider = String(edit.value);
          }
          if (edit.keyPath === 'model') {
            config.model = String(edit.value);
          }
        }
        return {};
      }
      case 'model/list':
        return {
          data: [
            {
              id: `${config.provider}-catalog-model`,
              isDefault: true,
              defaultReasoningEffort: 'medium',
            },
          ],
        };
      case 'thread/list':
        return { data: [threadSummary(scenario.threadProvider)] };
      case 'thread/resume': {
        // The scenario describes the session a resume with overrides ends up with. A plain
        // resume keeps the stored thread settings.
        const requested = (params as { modelProvider?: string } | undefined)?.modelProvider;
        const sessionProvider = requested ? scenario.sessionProvider : scenario.threadProvider;
        return {
          thread: threadSummary(scenario.threadProvider),
          model: `${sessionProvider}-session-model`,
          modelProvider: sessionProvider,
          reasoningEffort: 'high',
        };
      }
      case 'thread/unsubscribe':
        return {};
      case 'turn/start':
        return { turn: { id: 'active-turn' } };
      case 'turn/steer':
        return {};
      case 'thread/fork':
        return { thread: { ...threadSummary('alpha'), id: 'side-thread' } };
      case 'thread/goal/get':
        return { goal: null };
      case 'project/list':
        return { data: [] };
      case 'slashCommands/list':
        return { data: [] };
      case 'skills/list':
        return { data: [] };
      case 'plugin/list':
        return { marketplaces: [], marketplaceLoadErrors: [] };
      case 'mcpServerStatus/list':
        return { data: [] };
      default:
        throw new Error(`unexpected app-server request: ${method}`);
    }
  };

  return {
    platform: 'darwin',
    getCwd: async () => CWD,
    appServer: {
      start: async () => ({ ok: true }),
      request,
      respond: async () => undefined,
      onNotification: () => () => undefined,
      onServerRequest: () => () => undefined,
      onStatus: () => () => undefined,
    },
  } as unknown as WorkxBridge;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let latest: WorkxController | null = null;

beforeEach(() => {
  window.localStorage.removeItem('workx.queueing');
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  latest = null;
});

describe('queued message actions', () => {
  it('keeps queued messages out of the transcript and preserves attachments when editing and steering', async () => {
    const bridge = createBridge({ threadProvider: 'alpha', sessionProvider: 'alpha' });
    const request = vi.spyOn(bridge.appServer, 'request');
    await renderWorkx(bridge);
    await act(async () => { await controller().openThread(THREAD_ID); await controller().sendMessage('start'); });
    await act(async () => { await controller().sendMessage('queued', [{ type: 'skill', name: 'test', path: '/skills/test' }], ['/image.png']); });
    const message = controller().queuedMessages[0];
    expect(controller().transcript.some((entry) => entry.id === message.id)).toBe(false);
    await act(async () => { controller().editQueued(message.id, 'edited'); });
    const input = [
      { type: 'text', text: 'edited', text_elements: [] },
      { type: 'localImage', path: '/image.png' },
      { type: 'skill', name: 'test', path: '/skills/test' },
    ];
    expect(controller().queuedMessages).toEqual([{ ...message, text: 'edited', input }]);
    await act(async () => { await controller().sendQueued(message.id, 'current'); });
    expect(request).toHaveBeenCalledWith('turn/steer', { threadId: THREAD_ID, input, expectedTurnId: 'active-turn' });
    expect(controller().queuedMessages).toEqual([]);
  });

  it('retains a queued message when steering fails', async () => {
    const bridge = createBridge({ threadProvider: 'alpha', sessionProvider: 'alpha' });
    await renderWorkx(bridge);
    await act(async () => { await controller().openThread(THREAD_ID); await controller().sendMessage('start'); });
    await act(async () => { await controller().sendMessage('queued'); });
    const messages = controller().queuedMessages;
    vi.spyOn(bridge.appServer, 'request').mockRejectedValueOnce(new Error('steer failed'));
    await act(async () => { await controller().sendQueued(messages[0].id, 'current'); });
    expect(controller().queuedMessages).toEqual(messages);
    expect(controller().error).toBe('steer failed');
    expect(controller().queueBusy).toBe(false);
  });

  it('forks a side chat for a queued message without touching the active conversation', async () => {
    const bridge = createBridge({ threadProvider: 'alpha', sessionProvider: 'alpha' });
    const request = vi.spyOn(bridge.appServer, 'request');
    await renderWorkx(bridge);
    await act(async () => { await controller().openThread(THREAD_ID); await controller().sendMessage('start'); });
    await act(async () => { await controller().sendMessage('side'); await controller().sendMessage('stay'); });
    const [side, stay] = controller().queuedMessages;
    await act(async () => {
      expect(await controller().sendQueued(side.id, 'side')).toEqual({ threadId: 'side-thread', message: side });
    });
    // 分支由侧边对话面板订阅后投递，因此这里不能先起一轮。
    expect(request).not.toHaveBeenCalledWith('turn/start', expect.objectContaining({ threadId: 'side-thread' }));
    expect(controller().activeThread?.id).toBe(THREAD_ID);
    expect(controller().queuedMessages).toEqual([stay]);
    await act(async () => { controller().removeQueued(stay.id); });
    expect(controller().queuedMessages).toEqual([]);
  });

  it('opens an empty side chat branch for the active thread', async () => {
    const bridge = createBridge({ threadProvider: 'alpha', sessionProvider: 'alpha' });
    const request = vi.spyOn(bridge.appServer, 'request');
    await renderWorkx(bridge);
    await act(async () => { await controller().openThread(THREAD_ID); });
    await act(async () => {
      expect(await controller().openSideChat()).toEqual({ threadId: 'side-thread', message: null });
    });
    expect(request).toHaveBeenCalledWith('thread/fork', {
      threadId: THREAD_ID, model: 'alpha-session-model', modelProvider: 'alpha',
    });
    expect(controller().activeThread?.id).toBe(THREAD_ID);
  });

  it('steers new messages after disabling queueing and persists the preference', async () => {
    const bridge = createBridge({ threadProvider: 'alpha', sessionProvider: 'alpha' });
    const request = vi.spyOn(bridge.appServer, 'request');
    await renderWorkx(bridge);
    await act(async () => { await controller().openThread(THREAD_ID); await controller().sendMessage('start'); });
    await act(async () => { controller().setQueueing(false); });
    await act(async () => { await controller().sendMessage('direct'); });
    expect(controller().queuedMessages).toEqual([]);
    expect(request).toHaveBeenCalledWith('turn/steer', {
      threadId: THREAD_ID, input: [{ type: 'text', text: 'direct', text_elements: [] }], expectedTurnId: 'active-turn',
    });
    expect(window.localStorage.getItem('workx.queueing')).toBe('false');
  });
});

afterEach(async () => {
  const mounted = root;
  root = null;
  if (mounted) {
    await act(async () => {
      mounted.unmount();
    });
  }
  container?.remove();
  container = null;
});

function controller(): WorkxController {
  if (!latest) {
    throw new Error('useWorkx has not rendered');
  }
  return latest;
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) {
      return;
    }
    await flush();
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function renderWorkx(bridge: WorkxBridge): Promise<void> {
  (window as unknown as { workx: WorkxBridge }).workx = bridge;
  const host = document.createElement('div');
  document.body.appendChild(host);
  container = host;
  const mounted = createRoot(host);
  root = mounted;
  function Probe() {
    latest = useWorkx();
    return null;
  }
  await act(async () => {
    mounted.render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
  });
  await waitFor(() => latest?.status === 'ready', 'app-server boot');
}

describe('provider switching on an open thread', () => {
  it('adopts the provider and model the resumed session reports', async () => {
    await renderWorkx(createBridge({ threadProvider: 'alpha', sessionProvider: 'beta' }));
    await act(async () => {
      await controller().openThread(THREAD_ID);
    });
    expect(controller().providerId).toBe('alpha');

    await act(async () => {
      await controller().selectProvider('beta');
    });

    expect(controller().error).toBeNull();
    expect(controller().warnings).toEqual([]);
    expect(controller().providerId).toBe('beta');
    expect(controller().selectedModelId).toBe('beta-session-model');
  });

  it('warns when the resumed session keeps the previous provider', async () => {
    await renderWorkx(createBridge({ threadProvider: 'alpha', sessionProvider: 'alpha' }));
    await act(async () => {
      await controller().openThread(THREAD_ID);
    });

    await act(async () => {
      await controller().selectProvider('beta');
    });

    // The chat keeps running on the stored provider, so the warning must name that state
    // while the composer keeps the provider the user picked for the next chat.
    expect(controller().warnings).toContain(translate('en', 'provider.switchDeferred'));
    expect(controller().providerId).toBe('beta');
  });
});
