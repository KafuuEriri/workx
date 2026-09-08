import {
  ChevronDown,
  FileDiff,
  Globe,
  Image as ImageIcon,
  ListChecks,
  ScrollText,
  Sparkles,
  SquareTerminal,
  TriangleAlert,
  Wrench,
  X,
} from 'lucide-react';
import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';

import type { ApprovalRequest } from '../app/useWorkx';
import type { Activity, ActivityIcon, TranscriptEntry } from '../app/transcript';
import { cn } from '../lib/cn';
import { Markdown } from './Markdown';

const ACTIVITY_ICONS: Record<ActivityIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  terminal: SquareTerminal,
  file: FileDiff,
  tool: Wrench,
  search: Globe,
  reasoning: Sparkles,
  plan: ListChecks,
  image: ImageIcon,
  output: ScrollText,
};

const ACTIVITY_VERBS: Record<ActivityIcon, string> = {
  terminal: 'ran commands',
  file: 'edited files',
  tool: 'called tools',
  search: 'searched the web',
  reasoning: 'reasoned',
  plan: 'planned',
  image: 'used images',
  output: 'read tool output',
};

interface MessageListProps {
  entries: TranscriptEntry[];
  running: boolean;
  error: string | null;
  warnings: string[];
  approvals: ApprovalRequest[];
  cwd: string;
  onResolveApproval: (id: string | number, decision: 'accept' | 'decline') => void;
  onDismissError: () => void;
}

export function MessageList({
  entries,
  running,
  error,
  warnings,
  approvals,
  cwd,
  onResolveApproval,
  onDismissError,
}: MessageListProps) {
  return (
    <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-7 px-6 pb-10 pt-2">
      {entries.length === 0 ? <EmptyState cwd={cwd} /> : null}

      {entries.map((entry) =>
        entry.kind === 'user' ? (
          <div key={entry.id} className="flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bubble px-4 py-2.5 text-[16px] leading-[1.5]">
              {entry.text}
            </div>
          </div>
        ) : (
          <AssistantTurn key={entry.id} entry={entry} />
        ),
      )}

      {approvals.map((approval) => (
        <ApprovalCard key={approval.id} approval={approval} onResolve={onResolveApproval} />
      ))}

      {warnings.map((warning, index) => (
        <Banner key={`${warning}-${index}`} tone="warning">
          {warning}
        </Banner>
      ))}

      {error ? (
        <Banner tone="error" onDismiss={onDismissError}>
          {error}
        </Banner>
      ) : null}

      {running && entries.length === 0 ? <Thinking /> : null}
    </div>
  );
}

function AssistantTurn({ entry }: { entry: Extract<TranscriptEntry, { kind: 'assistant' }> }) {
  const [open, setOpen] = useState(false);
  const hasActivities = entry.activities.length > 0;

  return (
    <div className="group/turn">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          disabled={!hasActivities}
          onClick={() => setOpen((value) => !value)}
          className="flex shrink-0 items-center gap-1 text-[13px] text-fg-tertiary enabled:hover:text-fg-secondary"
        >
          <span>
            {entry.active
              ? 'Working…'
              : entry.durationMs !== null
                ? `Worked for ${formatDuration(entry.durationMs)}`
                : 'Worked'}
          </span>
          {hasActivities ? (
            <ChevronDown
              className={cn('size-3.5 transition-transform', open && 'rotate-180')}
              strokeWidth={1.75}
            />
          ) : null}
        </button>
        <div className="h-px flex-1 bg-line-subtle" />
      </div>

      {open && hasActivities ? (
        <div className="mt-2.5">
          <p className="text-[14px] text-fg-secondary">{summarize(entry.activities)}</p>
          <div className="mt-1.5 flex flex-col gap-px">
            {entry.activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      ) : null}

      {entry.text ? (
        <div className="mt-3">
          <Markdown>{entry.text}</Markdown>
        </div>
      ) : entry.active ? (
        <div className="mt-3">
          <Thinking />
        </div>
      ) : null}

      {entry.status === 'failed' ? (
        <div className="mt-3">
          <Banner tone="error">This turn failed. Check the error above for details.</Banner>
        </div>
      ) : null}
    </div>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const Icon = ACTIVITY_ICONS[activity.icon];
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 py-[3px] text-[14px] text-fg-secondary',
        activity.active && 'text-fg',
      )}
    >
      <Icon
        className={cn(
          'mt-[3px] size-4 shrink-0 text-fg-tertiary',
          activity.active && 'animate-pulse text-fg',
        )}
        strokeWidth={1.75}
      />
      <span className="min-w-0 break-words font-mono text-[13px]">{activity.label}</span>
      {activity.status ? (
        <span
          className={cn(
            'ml-auto shrink-0 text-[12px]',
            activity.status === 'failed' ? 'text-danger' : 'text-fg-tertiary',
          )}
        >
          {activity.status}
        </span>
      ) : null}
    </div>
  );
}

function ApprovalCard({
  approval,
  onResolve,
}: {
  approval: ApprovalRequest;
  onResolve: (id: string | number, decision: 'accept' | 'decline') => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-elevated p-3.5">
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium">
            {approval.kind === 'command' ? 'Approve command?' : 'Approve file changes?'}
          </p>
          <p className="mt-1 break-words font-mono text-[13px] text-fg-secondary">
            {approval.title}
          </p>
          {approval.detail ? (
            <p className="mt-1 break-words text-[12px] text-fg-tertiary">{approval.detail}</p>
          ) : null}
          {approval.reason ? (
            <p className="mt-1 text-[12px] text-fg-tertiary">{approval.reason}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onResolve(approval.id, 'decline')}
          className="h-7 rounded-full border border-line px-3 text-[13px] hover:bg-hover"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => onResolve(approval.id, 'accept')}
          className="h-7 rounded-full bg-send px-3 text-[13px] text-send-fg"
        >
          Approve
        </button>
      </div>
    </div>
  );
}

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: 'warning' | 'error';
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px]',
        tone === 'error'
          ? 'border-danger/30 bg-danger/10 text-danger'
          : 'border-warning/30 bg-warning/10 text-warning',
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0">
          <X className="size-3.5" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 text-[14px] text-fg-tertiary">
      <span className="size-1.5 animate-pulse rounded-full bg-fg-tertiary" />
      Thinking…
    </div>
  );
}

function EmptyState({ cwd }: { cwd: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-20 text-center">
      <p className="text-[17px] font-medium">What should Workx work on?</p>
      <p className="max-w-[360px] text-[13px] text-fg-tertiary">
        Ask a question or describe a task. Workx will work in{' '}
        <span className="break-all font-mono">{cwd || 'the current directory'}</span>.
      </p>
    </div>
  );
}

function summarize(activities: Activity[]): string {
  const verbs: string[] = [];
  for (const activity of activities) {
    const verb = ACTIVITY_VERBS[activity.icon];
    if (!verbs.includes(verb)) {
      verbs.push(verb);
    }
  }
  if (verbs.length === 0) {
    return 'Worked';
  }
  return verbs.join(', ');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
