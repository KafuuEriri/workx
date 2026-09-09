import { act, renderHook, waitFor } from '@testing-library/react';
import type { Project } from '@protocol/v2/Project';
import type { Thread } from '@protocol/v2/Thread';
import { expect, vi } from 'vitest';

import { useWorkx } from '../app/useWorkx';
import { I18nProvider } from '../lib/i18n';

export const project = {
  id: 'project', name: 'Multi-root project',
  roots: [{ path: '/workspace/frontend' }, { path: '/workspace/backend' }],
  metadata: {}, position: 0, createdAt: 0, updatedAt: 0, recencyAt: null,
} satisfies Project;

export function thread(id: string, projectId: string | null = project.id): Thread {
  return {
    id, projectId, cwd: '/workspace/frontend', turns: [], preview: '',
    sessionId: id, forkedFromId: null, parentThreadId: null, ephemeral: false,
    section: null, sectionEnteredAt: null, historyMode: 'legacy', modelProvider: 'openai',
    model: null, reasoningEffort: null, createdAt: 0, updatedAt: 0, recencyAt: null,
    status: { type: 'idle' }, path: null, cliVersion: 'test', source: 'appServer',
    threadSource: null, agentNickname: null, agentRole: null, gitInfo: null, name: null,
  };
}

export async function setupWorkx() {
  const request = vi.fn(async (method: string, params?: unknown): Promise<unknown> => {
    switch (method) {
      case 'project/list': return { data: [project] };
      case 'thread/list': return { data: [thread('saved')] };
      case 'config/read': return { config: {} };
      case 'plugin/list': return { marketplaces: [], marketplaceLoadErrors: [] };
      case 'thread/start': return { thread: thread('new', (params as { projectId?: string }).projectId ?? null) };
      case 'thread/resume': return { thread: thread('saved') };
      case 'turn/start': return { turn: { id: 'turn' } };
      case 'fuzzyFileSearch': return { files: [] };
      default: return { data: [] };
    }
  });
  let notify: (notification: { method: string; params: unknown }) => void = () => undefined;
  window.workx = {
    getCwd: async () => '/home/user',
    appServer: {
      start: async () => ({ ok: true }),
      request,
      onNotification: (handler: typeof notify) => { notify = handler; return () => undefined; },
      onServerRequest: () => () => undefined,
      onStatus: () => () => undefined,
    },
  } as unknown as typeof window.workx;
  const { result } = renderHook(useWorkx, { wrapper: I18nProvider });
  await waitFor(() => {
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.status).toBe('ready');
  });
  return {
    result, request,
    notify: (method: string, params: unknown) => act(() => notify({ method, params })),
  };
}
