import type { AgentMessageDeltaNotification } from '@protocol/v2/AgentMessageDeltaNotification';
import type { CommandExecutionRequestApprovalParams } from '@protocol/v2/CommandExecutionRequestApprovalParams';
import type { ErrorNotification } from '@protocol/v2/ErrorNotification';
import type { FileChangeRequestApprovalParams } from '@protocol/v2/FileChangeRequestApprovalParams';
import type { ItemCompletedNotification } from '@protocol/v2/ItemCompletedNotification';
import type { ItemStartedNotification } from '@protocol/v2/ItemStartedNotification';
import type { Model } from '@protocol/v2/Model';
import type { ModelListResponse } from '@protocol/v2/ModelListResponse';
import type { MarketplaceLoadErrorInfo } from '@protocol/v2/MarketplaceLoadErrorInfo';
import type { McpServerStatus } from '@protocol/v2/McpServerStatus';
import type { ListMcpServerStatusResponse } from '@protocol/v2/ListMcpServerStatusResponse';
import type { PluginListResponse } from '@protocol/v2/PluginListResponse';
import type { PluginMarketplaceEntry } from '@protocol/v2/PluginMarketplaceEntry';
import type { SkillErrorInfo } from '@protocol/v2/SkillErrorInfo';
import type { SkillMetadata } from '@protocol/v2/SkillMetadata';
import type { SkillsListResponse } from '@protocol/v2/SkillsListResponse';
import type { Thread } from '@protocol/v2/Thread';
import type { ThreadArchivedNotification } from '@protocol/v2/ThreadArchivedNotification';
import type { ThreadDeletedNotification } from '@protocol/v2/ThreadDeletedNotification';
import type { ThreadItem } from '@protocol/v2/ThreadItem';
import type { ThreadListResponse } from '@protocol/v2/ThreadListResponse';
import type { ThreadNameUpdatedNotification } from '@protocol/v2/ThreadNameUpdatedNotification';
import type { ThreadResumeResponse } from '@protocol/v2/ThreadResumeResponse';
import type { ThreadStartResponse } from '@protocol/v2/ThreadStartResponse';
import type { Turn } from '@protocol/v2/Turn';
import type { TurnCompletedNotification } from '@protocol/v2/TurnCompletedNotification';
import type { TurnStartedNotification } from '@protocol/v2/TurnStartedNotification';
import type { TurnStartResponse } from '@protocol/v2/TurnStartResponse';
import type { WarningNotification } from '@protocol/v2/WarningNotification';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { PERMISSION_MODES, type PermissionMode } from '../data/workspace';
import { buildTranscript, type TranscriptEntry, type TurnView } from './transcript';

interface ThreadSearchResponse {
  data: Array<{ thread: Thread; snippet: string }>;
  nextCursor: string | null;
}

export interface ApprovalRequest {
  id: string | number;
  kind: 'command' | 'file';
  title: string;
  detail?: string;
  reason?: string | null;
}

export interface ProjectView {
  id: string;
  name: string;
  cwd: string;
  threads: Thread[];
}

export interface WorkxController {
  status: 'connecting' | 'ready' | 'error' | 'stopped';
  statusMessage: string | null;
  models: Model[];
  selectedModelId: string | null;
  selectModel: (id: string) => void;
  selectedEffort: string | null;
  setEffort: (effort: string) => void;
  permission: PermissionMode;
  setPermission: (mode: PermissionMode) => void;
  projects: ProjectView[];
  recents: Thread[];
  activeThread: Thread | null;
  transcript: TranscriptEntry[];
  running: boolean;
  approvals: ApprovalRequest[];
  warnings: string[];
  error: string | null;
  cwd: string;
  searchTerm: string;
  searchResults: Thread[];
  searching: boolean;
  pluginMarketplaces: PluginMarketplaceEntry[];
  pluginErrors: MarketplaceLoadErrorInfo[];
  pluginsLoading: boolean;
  skills: SkillMetadata[];
  skillErrors: SkillErrorInfo[];
  skillsLoading: boolean;
  mcpServers: McpServerStatus[];
  mcpLoading: boolean;
  setActiveCwd: (cwd: string) => void;
  newThread: () => Promise<void>;
  openThread: (id: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  interrupt: () => Promise<void>;
  renameThread: (id: string, name: string) => Promise<void>;
  archiveThread: (id: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  setSearchTerm: (term: string) => void;
  refreshPlugins: () => Promise<void>;
  refreshSkills: () => Promise<void>;
  refreshMcpServers: () => Promise<void>;
  resolveApproval: (id: string | number, decision: 'accept' | 'decline') => Promise<void>;
  dismissError: () => void;
  refreshThreads: () => Promise<void>;
}

interface State {
  status: WorkxController['status'];
  statusMessage: string | null;
  models: Model[];
  threads: Thread[];
  activeThread: Thread | null;
  turns: TurnView[];
  running: boolean;
  activeTurnId: string | null;
  approvals: ApprovalRequest[];
  warnings: string[];
  error: string | null;
  searchTerm: string;
  searchResults: Thread[];
  searching: boolean;
  pluginMarketplaces: PluginMarketplaceEntry[];
  pluginErrors: MarketplaceLoadErrorInfo[];
  pluginsLoading: boolean;
  skills: SkillMetadata[];
  skillErrors: SkillErrorInfo[];
  skillsLoading: boolean;
  mcpServers: McpServerStatus[];
  mcpLoading: boolean;
}

type Action =
  | { type: 'status'; status: State['status']; message?: string | null }
  | { type: 'models'; models: Model[] }
  | { type: 'threads'; threads: Thread[] }
  | { type: 'thread'; thread: Thread; turns: TurnView[] }
  | { type: 'item'; turnId: string; item: ThreadItem }
  | { type: 'delta'; turnId: string; itemId: string; delta: string }
  | { type: 'turnStarted'; turnId: string; startedAtMs: number | null }
  | { type: 'turnCompleted'; turnId: string; durationMs: number | null; status: TurnView['status'] }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string | null }
  | { type: 'approvalAdd'; approval: ApprovalRequest }
  | { type: 'approvalRemove'; id: string | number }
  | { type: 'searchTerm'; term: string }
  | { type: 'searchResults'; results: Thread[]; searching: boolean }
  | { type: 'threadUpdated'; thread: Thread }
  | { type: 'threadRemoved'; threadId: string }
  | {
      type: 'plugins';
      marketplaces: PluginMarketplaceEntry[];
      errors: MarketplaceLoadErrorInfo[];
    }
  | { type: 'pluginsLoading'; loading: boolean }
  | { type: 'skills'; skills: SkillMetadata[]; errors: SkillErrorInfo[] }
  | { type: 'skillsLoading'; loading: boolean }
  | { type: 'mcp'; servers: McpServerStatus[] }
  | { type: 'mcpLoading'; loading: boolean };

const initialState: State = {
  status: 'connecting',
  statusMessage: null,
  models: [],
  threads: [],
  activeThread: null,
  turns: [],
  running: false,
  activeTurnId: null,
  approvals: [],
  warnings: [],
  error: null,
  searchTerm: '',
  searchResults: [],
  searching: false,
  pluginMarketplaces: [],
  pluginErrors: [],
  pluginsLoading: false,
  skills: [],
  skillErrors: [],
  skillsLoading: false,
  mcpServers: [],
  mcpLoading: false,
};

function upsertItem(items: ThreadItem[], item: ThreadItem): ThreadItem[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index < 0) {
    return [...items, item];
  }
  return items.map((existing, position) => (position === index ? item : existing));
}

function upsertTurn(turns: TurnView[], turnId: string): [TurnView[], TurnView] {
  const existing = turns.find((turn) => turn.id === turnId);
  if (existing) {
    return [turns, existing];
  }
  const created: TurnView = {
    id: turnId,
    items: [],
    status: null,
    durationMs: null,
    startedAtMs: null,
  };
  return [[...turns, created], created];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'status':
      return { ...state, status: action.status, statusMessage: action.message ?? null };
    case 'models':
      return { ...state, models: action.models };
    case 'threads':
      return {
        ...state,
        threads: action.threads,
        activeThread: state.activeThread
          ? (action.threads.find((thread) => thread.id === state.activeThread?.id) ??
            state.activeThread)
          : null,
      };
    case 'thread':
      return {
        ...state,
        activeThread: action.thread,
        turns: action.turns,
        running: action.turns.some((turn) => turn.status === 'inProgress'),
        activeTurnId: null,
        error: null,
        warnings: [],
        approvals: [],
      };
    case 'item': {
      const [turns, turn] = upsertTurn(state.turns, action.turnId);
      return {
        ...state,
        turns: turns.map((entry) =>
          entry.id === turn.id ? { ...entry, items: upsertItem(entry.items, action.item) } : entry,
        ),
      };
    }
    case 'delta': {
      const [turns, turn] = upsertTurn(state.turns, action.turnId);
      const hasItem = turn.items.some((item) => item.id === action.itemId);
      const items = hasItem
        ? turn.items.map((item) =>
            item.id === action.itemId && item.type === 'agentMessage'
              ? { ...item, text: item.text + action.delta }
              : item,
          )
        : [
            ...turn.items,
            {
              type: 'agentMessage' as const,
              id: action.itemId,
              text: action.delta,
              phase: null,
              memoryCitation: null,
              delivery: null,
              questions: null,
            },
          ];
      return {
        ...state,
        turns: turns.map((entry) => (entry.id === turn.id ? { ...entry, items } : entry)),
      };
    }
    case 'turnStarted': {
      const [turns, turn] = upsertTurn(state.turns, action.turnId);
      return {
        ...state,
        running: true,
        activeTurnId: action.turnId,
        turns: turns.map((entry) =>
          entry.id === turn.id
            ? { ...entry, startedAtMs: action.startedAtMs, status: 'inProgress' }
            : entry,
        ),
      };
    }
    case 'turnCompleted':
      return {
        ...state,
        running: false,
        activeTurnId: null,
        approvals: [],
        turns: state.turns.map((entry) =>
          entry.id === action.turnId
            ? { ...entry, status: action.status, durationMs: action.durationMs }
            : entry,
        ),
      };
    case 'warning':
      return { ...state, warnings: [...state.warnings.slice(-4), action.message] };
    case 'error':
      return { ...state, error: action.message };
    case 'approvalAdd':
      return { ...state, approvals: [...state.approvals, action.approval] };
    case 'approvalRemove':
      return {
        ...state,
        approvals: state.approvals.filter((approval) => approval.id !== action.id),
      };
    case 'searchTerm':
      return {
        ...state,
        searchTerm: action.term,
        searchResults: action.term.trim() ? state.searchResults : [],
      };
    case 'searchResults':
      return { ...state, searchResults: action.results, searching: action.searching };
    case 'threadUpdated':
      return {
        ...state,
        threads: state.threads.map((thread) =>
          thread.id === action.thread.id ? action.thread : thread,
        ),
        activeThread:
          state.activeThread?.id === action.thread.id ? action.thread : state.activeThread,
      };
    case 'threadRemoved':
      return {
        ...state,
        threads: state.threads.filter((thread) => thread.id !== action.threadId),
        activeThread:
          state.activeThread?.id === action.threadId ? null : state.activeThread,
        turns: state.activeThread?.id === action.threadId ? [] : state.turns,
      };
    case 'plugins':
      return {
        ...state,
        pluginMarketplaces: action.marketplaces,
        pluginErrors: action.errors,
        pluginsLoading: false,
      };
    case 'pluginsLoading':
      return { ...state, pluginsLoading: action.loading };
    case 'skills':
      return {
        ...state,
        skills: action.skills,
        skillErrors: action.errors,
        skillsLoading: false,
      };
    case 'skillsLoading':
      return { ...state, skillsLoading: action.loading };
    case 'mcp':
      return { ...state, mcpServers: action.servers, mcpLoading: false };
    case 'mcpLoading':
      return { ...state, mcpLoading: action.loading };
    default:
      return state;
  }
}

function turnView(turn: Turn): TurnView {
  return {
    id: turn.id,
    items: turn.items,
    status: turn.status,
    durationMs: turn.durationMs,
    startedAtMs: turn.startedAt === null ? null : turn.startedAt * 1000,
  };
}

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function useWorkx(): WorkxController {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [effortId, setEffortId] = useState<string | null>(null);
  const [permissionId, setPermissionId] = useState('full-access');
  const [cwd, setCwd] = useState('');

  const threadIdRef = useRef<string | null>(null);
  const turnIdRef = useRef<string | null>(null);
  const modelRef = useRef<string | null>(null);
  const effortRef = useRef<string | null>(null);
  const permissionRef = useRef<PermissionMode>(
    PERMISSION_MODES.find((mode) => mode.id === 'full-access') ?? PERMISSION_MODES[0],
  );
  const cwdRef = useRef('');
  const bootedRef = useRef(false);
  const threadsRef = useRef<Thread[]>([]);

  const permission = useMemo(
    () => PERMISSION_MODES.find((mode) => mode.id === permissionId) ?? PERMISSION_MODES[0],
    [permissionId],
  );

  useEffect(() => {
    permissionRef.current = permission;
  }, [permission]);

  useEffect(() => {
    threadsRef.current = state.threads;
  }, [state.threads]);

  const request = useCallback(<T,>(method: string, params?: unknown): Promise<T> => {
    return window.workx.appServer.request<T>(method, params);
  }, []);

  const refreshThreads = useCallback(async () => {
    const response = await request<ThreadListResponse>('thread/list', { limit: 60 });
    dispatch({ type: 'threads', threads: response.data });
  }, [request]);

  const refreshModels = useCallback(async () => {
    const response = await request<ModelListResponse>('model/list', {});
    dispatch({ type: 'models', models: response.data });
    if (!modelRef.current) {
      const preferred =
        response.data.find((model) => model.isDefault) ?? response.data[0] ?? null;
      if (preferred) {
        modelRef.current = preferred.id;
        setSelectedModelId(preferred.id);
        effortRef.current = preferred.defaultReasoningEffort ?? null;
        setEffortId(preferred.defaultReasoningEffort ?? null);
      }
    }
  }, [request]);

  const startThread = useCallback(async (): Promise<string> => {
    const response = await request<ThreadStartResponse>('thread/start', {
      cwd: cwdRef.current || undefined,
      model: modelRef.current ?? undefined,
      approvalPolicy: permissionRef.current.approvalPolicy,
      sandbox: permissionRef.current.sandbox,
    });
    threadIdRef.current = response.thread.id;
    turnIdRef.current = null;
    dispatch({ type: 'thread', thread: response.thread, turns: [] });
    void refreshThreads();
    return response.thread.id;
  }, [request, refreshThreads]);

  const newThread = useCallback(async () => {
    await startThread();
  }, [startThread]);

  const openThread = useCallback(
    async (id: string) => {
      const response = await request<ThreadResumeResponse>('thread/resume', { threadId: id });
      threadIdRef.current = response.thread.id;
      turnIdRef.current = null;
      dispatch({
        type: 'thread',
        thread: response.thread,
        turns: response.thread.turns.map(turnView),
      });
    },
    [request],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const threadId = threadIdRef.current ?? (await startThread());
      const response = await request<TurnStartResponse>('turn/start', {
        threadId,
        input: [{ type: 'text', text, text_elements: [] }],
        effort: effortRef.current ?? undefined,
      });
      turnIdRef.current = response.turn.id;
      dispatch({
        type: 'turnStarted',
        turnId: response.turn.id,
        startedAtMs: Date.now(),
      });
    },
    [request, startThread],
  );

  const interrupt = useCallback(async () => {
    const threadId = threadIdRef.current;
    const turnId = turnIdRef.current;
    if (!threadId || !turnId) {
      return;
    }
    await request('turn/interrupt', { threadId, turnId });
  }, [request]);

  const renameThread = useCallback(
    async (id: string, name: string) => {
      await request('thread/name/set', { threadId: id, name });
      const thread = state.threads.find((candidate) => candidate.id === id);
      if (thread) {
        dispatch({ type: 'threadUpdated', thread: { ...thread, name } });
      }
    },
    [request, state.threads],
  );

  const archiveThread = useCallback(
    async (id: string) => {
      await request('thread/archive', { threadId: id });
      dispatch({ type: 'threadRemoved', threadId: id });
      void refreshThreads();
    },
    [request, refreshThreads],
  );

  const deleteThread = useCallback(
    async (id: string) => {
      await request('thread/delete', { threadId: id });
      dispatch({ type: 'threadRemoved', threadId: id });
      void refreshThreads();
    },
    [request, refreshThreads],
  );

  const setSearchTerm = useCallback(
    (term: string) => {
      dispatch({ type: 'searchTerm', term });
      if (!term.trim()) {
        dispatch({ type: 'searchResults', results: [], searching: false });
      }
    },
    [],
  );

  const refreshPlugins = useCallback(async () => {
    dispatch({ type: 'pluginsLoading', loading: true });
    try {
      const response = await request<PluginListResponse>('plugin/list', {
        cwds: cwdRef.current ? [cwdRef.current] : undefined,
      });
      dispatch({
        type: 'plugins',
        marketplaces: response.marketplaces,
        errors: response.marketplaceLoadErrors,
      });
    } catch (error) {
      dispatch({
        type: 'plugins',
        marketplaces: [],
        errors: [
          {
            marketplacePath: '',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      });
    }
  }, [request]);

  const refreshSkills = useCallback(async () => {
    dispatch({ type: 'skillsLoading', loading: true });
    try {
      const response = await request<SkillsListResponse>('skills/list', {
        cwds: cwdRef.current ? [cwdRef.current] : [],
      });
      dispatch({
        type: 'skills',
        skills: response.data.flatMap((entry) => entry.skills),
        errors: response.data.flatMap((entry) => entry.errors),
      });
    } catch (error) {
      dispatch({
        type: 'skills',
        skills: [],
        errors: [
          {
            path: '',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      });
    }
  }, [request]);

  const refreshMcpServers = useCallback(async () => {
    dispatch({ type: 'mcpLoading', loading: true });
    try {
      const response = await request<ListMcpServerStatusResponse>('mcpServerStatus/list', {
        limit: 50,
      });
      dispatch({ type: 'mcp', servers: response.data });
    } catch {
      dispatch({ type: 'mcp', servers: [] });
    }
  }, [request]);

  const resolveApproval = useCallback(
    async (id: string | number, decision: 'accept' | 'decline') => {
      await window.workx.appServer.respond(id, { decision });
      dispatch({ type: 'approvalRemove', id });
    },
    [],
  );

  const handleNotification = useCallback(
    (notification: { method: string; params: unknown }) => {
      switch (notification.method) {
        case 'turn/started': {
          const params = notification.params as TurnStartedNotification;
          turnIdRef.current = params.turn.id;
          dispatch({
            type: 'turnStarted',
            turnId: params.turn.id,
            startedAtMs: params.turn.startedAt ? params.turn.startedAt * 1000 : Date.now(),
          });
          break;
        }
        case 'item/started': {
          const params = notification.params as ItemStartedNotification;
          dispatch({ type: 'item', turnId: params.turnId, item: params.item });
          break;
        }
        case 'item/completed': {
          const params = notification.params as ItemCompletedNotification;
          dispatch({ type: 'item', turnId: params.turnId, item: params.item });
          break;
        }
        case 'item/agentMessage/delta': {
          const params = notification.params as AgentMessageDeltaNotification;
          dispatch({
            type: 'delta',
            turnId: params.turnId,
            itemId: params.itemId,
            delta: params.delta,
          });
          break;
        }
        case 'turn/completed': {
          const params = notification.params as TurnCompletedNotification;
          turnIdRef.current = null;
          dispatch({
            type: 'turnCompleted',
            turnId: params.turn.id,
            durationMs: params.turn.durationMs,
            status: params.turn.status,
          });
          void refreshThreads();
          break;
        }
        case 'error': {
          const params = notification.params as ErrorNotification;
          dispatch({ type: 'error', message: params.error.message });
          break;
        }
        case 'warning': {
          const params = notification.params as WarningNotification;
          dispatch({ type: 'warning', message: params.message });
          break;
        }
        case 'thread/name/updated': {
          const params = notification.params as ThreadNameUpdatedNotification;
          const thread = threadsRef.current.find((candidate) => candidate.id === params.threadId);
          if (thread && params.threadName !== undefined) {
            dispatch({ type: 'threadUpdated', thread: { ...thread, name: params.threadName } });
          }
          break;
        }
        case 'thread/archived':
        case 'thread/deleted': {
          const params = notification.params as
            | ThreadArchivedNotification
            | ThreadDeletedNotification;
          dispatch({ type: 'threadRemoved', threadId: params.threadId });
          break;
        }
        default:
          break;
      }
    },
    [refreshThreads],
  );

  const handleServerRequest = useCallback(
    (serverRequest: { id: string | number; method: string; params: unknown }) => {
      switch (serverRequest.method) {
        case 'item/commandExecution/requestApproval': {
          const params = serverRequest.params as CommandExecutionRequestApprovalParams;
          dispatch({
            type: 'approvalAdd',
            approval: {
              id: serverRequest.id,
              kind: 'command',
              title: params.command ?? 'Run a command',
              detail: params.cwd ?? undefined,
              reason: params.reason ?? null,
            },
          });
          break;
        }
        case 'item/fileChange/requestApproval': {
          const params = serverRequest.params as FileChangeRequestApprovalParams;
          dispatch({
            type: 'approvalAdd',
            approval: {
              id: serverRequest.id,
              kind: 'file',
              title: 'Apply file changes',
              detail: params.grantRoot ?? undefined,
              reason: params.reason ?? null,
            },
          });
          break;
        }
        default:
          void window.workx.appServer.respond(serverRequest.id, undefined, {
            code: -32601,
            message: `Workx Desktop does not handle ${serverRequest.method}`,
          });
      }
    },
    [],
  );

  useEffect(() => {
    const offNotification = window.workx.appServer.onNotification(handleNotification);
    const offServerRequest = window.workx.appServer.onServerRequest(handleServerRequest);
    const offStatus = window.workx.appServer.onStatus((status) => {
      if (status.status === 'ready') {
        dispatch({ type: 'status', status: 'ready' });
      } else if (status.status === 'stopped') {
        dispatch({ type: 'status', status: 'stopped', message: 'app-server stopped' });
      } else if (status.status === 'error') {
        dispatch({ type: 'status', status: 'error', message: status.message });
      }
    });

    return () => {
      offNotification();
      offServerRequest();
      offStatus();
    };
  }, [handleNotification, handleServerRequest]);

  useEffect(() => {
    if (bootedRef.current) {
      return;
    }
    bootedRef.current = true;

    void (async () => {
      dispatch({ type: 'status', status: 'connecting' });
      try {
        const home = await window.workx.getCwd();
        cwdRef.current = home;
        setCwd(home);
        const result = await window.workx.appServer.start();
        if (!result.ok) {
          dispatch({ type: 'status', status: 'error', message: result.message ?? 'failed' });
          return;
        }
        dispatch({ type: 'status', status: 'ready' });
        await Promise.all([refreshModels(), refreshThreads()]);
      } catch (error) {
        dispatch({
          type: 'status',
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, [refreshModels, refreshThreads]);

  useEffect(() => {
    const term = state.searchTerm.trim();
    if (!term) {
      return;
    }
    dispatch({ type: 'searchResults', results: [], searching: true });
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await request<ThreadSearchResponse>('thread/search', {
            searchTerm: term,
            limit: 20,
          });
          dispatch({
            type: 'searchResults',
            results: response.data.map((result) => result.thread),
            searching: false,
          });
        } catch (error) {
          dispatch({ type: 'searchResults', results: [], searching: false });
          dispatch({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [state.searchTerm, request]);

  const transcript = useMemo(() => buildTranscript(state.turns), [state.turns]);

  const projects = useMemo<ProjectView[]>(() => {
    const byCwd = new Map<string, ProjectView>();
    for (const thread of state.threads) {
      const key = thread.cwd;
      const existing = byCwd.get(key);
      if (existing) {
        existing.threads.push(thread);
      } else {
        byCwd.set(key, {
          id: key,
          name: basename(key),
          cwd: key,
          threads: [thread],
        });
      }
    }
    return [...byCwd.values()];
  }, [state.threads]);

  const recents = useMemo(() => state.threads.slice(0, 12), [state.threads]);

  return {
    status: state.status,
    statusMessage: state.statusMessage,
    models: state.models,
    selectedModelId,
    selectModel: (id) => {
      modelRef.current = id;
      setSelectedModelId(id);
      const model = state.models.find((candidate) => candidate.id === id);
      if (model) {
        effortRef.current = model.defaultReasoningEffort ?? null;
        setEffortId(model.defaultReasoningEffort ?? null);
      }
    },
    selectedEffort: effortId,
    setEffort: (effort) => {
      effortRef.current = effort;
      setEffortId(effort);
    },
    permission,
    setPermission: (mode) => {
      permissionRef.current = mode;
      setPermissionId(mode.id);
    },
    projects,
    recents,
    activeThread: state.activeThread,
    transcript,
    running: state.running,
    approvals: state.approvals,
    warnings: state.warnings,
    error: state.error,
    cwd,
    searchTerm: state.searchTerm,
    searchResults: state.searchResults,
    searching: state.searching,
    pluginMarketplaces: state.pluginMarketplaces,
    pluginErrors: state.pluginErrors,
    pluginsLoading: state.pluginsLoading,
    skills: state.skills,
    skillErrors: state.skillErrors,
    skillsLoading: state.skillsLoading,
    mcpServers: state.mcpServers,
    mcpLoading: state.mcpLoading,
    setActiveCwd: (next) => {
      cwdRef.current = next;
      setCwd(next);
    },
    newThread,
    openThread,
    sendMessage,
    interrupt,
    renameThread,
    archiveThread,
    deleteThread,
    setSearchTerm,
    refreshPlugins,
    refreshSkills,
    refreshMcpServers,
    resolveApproval,
    dismissError: () => dispatch({ type: 'error', message: null }),
    refreshThreads,
  };
}
