import type { ThreadItem } from '@protocol/v2/ThreadItem';
import type { TurnStatus } from '@protocol/v2/TurnStatus';
import type { UserInput } from '@protocol/v2/UserInput';

export type ActivityIcon =
  | 'terminal'
  | 'file'
  | 'tool'
  | 'search'
  | 'reasoning'
  | 'plan'
  | 'image'
  | 'output';

export interface Activity {
  id: string;
  icon: ActivityIcon;
  label: string;
  detail?: string;
  status?: string;
  active: boolean;
}

export type TranscriptEntry =
  | { kind: 'user'; id: string; text: string }
  | {
      kind: 'assistant';
      id: string;
      text: string;
      activities: Activity[];
      durationMs: number | null;
      status: TurnStatus | null;
      active: boolean;
    };

export interface TurnView {
  id: string;
  items: ThreadItem[];
  status: TurnStatus | null;
  durationMs: number | null;
  startedAtMs: number | null;
}

export function textFromUserInput(content: UserInput[]): string {
  return content
    .filter((part): part is Extract<UserInput, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

export function activityFromItem(item: ThreadItem): Activity | null {
  switch (item.type) {
    case 'commandExecution':
      return {
        id: item.id,
        icon: 'terminal',
        label: item.command,
        detail: item.cwd,
        status: item.status,
        active: item.status === 'inProgress',
      };
    case 'fileChange':
      return {
        id: item.id,
        icon: 'file',
        label: `${item.changes.length} file${item.changes.length === 1 ? '' : 's'} changed`,
        detail: item.changes.map((change) => change.path).join(', '),
        status: item.status,
        active: item.status === 'inProgress',
      };
    case 'mcpToolCall':
      return {
        id: item.id,
        icon: 'tool',
        label: `${item.server} / ${item.tool}`,
        status: item.status,
        active: item.status === 'inProgress',
      };
    case 'dynamicToolCall':
      return {
        id: item.id,
        icon: 'tool',
        label: item.namespace ? `${item.namespace} / ${item.tool}` : item.tool,
        status: item.status,
        active: item.status === 'inProgress',
      };
    case 'webSearch':
      return {
        id: item.id,
        icon: 'search',
        label: item.query ? `Searched the web for ${item.query}` : 'Searched the web',
        active: false,
      };
    case 'reasoning':
      return {
        id: item.id,
        icon: 'reasoning',
        label: item.summary[0] ?? 'Thinking',
        active: false,
      };
    case 'plan':
      return { id: item.id, icon: 'plan', label: 'Updated the plan', active: false };
    case 'functionCallOutput':
      return { id: item.id, icon: 'output', label: item.name, active: false };
    case 'imageView':
      return { id: item.id, icon: 'image', label: 'Viewed an image', active: false };
    case 'imageGeneration':
      return { id: item.id, icon: 'image', label: 'Generated an image', active: false };
    case 'contextCompaction':
      return { id: item.id, icon: 'plan', label: 'Compacted context', active: false };
    case 'subAgentActivity':
      return { id: item.id, icon: 'tool', label: 'Sub-agent activity', active: false };
    case 'sleep':
      return { id: item.id, icon: 'plan', label: 'Waiting', active: true };
    default:
      return null;
  }
}

export function buildTranscript(turns: TurnView[]): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];

  for (const turn of turns) {
    const activities: Activity[] = [];
    let assistantEntry: Extract<TranscriptEntry, { kind: 'assistant' }> | null = null;

    for (const item of turn.items) {
      if (item.type === 'userMessage') {
        entries.push({ kind: 'user', id: item.id, text: textFromUserInput(item.content) });
        continue;
      }
      if (item.type === 'agentMessage') {
        assistantEntry = {
          kind: 'assistant',
          id: item.id,
          text: item.text,
          activities: [...activities],
          durationMs: null,
          status: turn.status,
          active: turn.status === 'inProgress',
        };
        entries.push(assistantEntry);
        activities.length = 0;
        continue;
      }
      const activity = activityFromItem(item);
      if (activity) {
        const index = activities.findIndex((existing) => existing.id === activity.id);
        if (index >= 0) {
          activities[index] = activity;
        } else {
          activities.push(activity);
        }
      }
    }

    const target =
      assistantEntry ??
      ({
        kind: 'assistant',
        id: `${turn.id}-summary`,
        text: '',
        activities: [],
        durationMs: null,
        status: turn.status,
        active: turn.status === 'inProgress',
      } satisfies Extract<TranscriptEntry, { kind: 'assistant' }>);

    if (!assistantEntry) {
      entries.push(target);
    }
    target.activities = [...target.activities, ...activities];
    target.durationMs = turn.durationMs;
    target.status = turn.status;
    target.active = turn.status === 'inProgress' || turn.status === null;
  }

  return entries;
}
