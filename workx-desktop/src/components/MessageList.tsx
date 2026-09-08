import {
  ChevronDown,
  Copy,
  Folder,
  GitBranch,
  Globe,
  SquareTerminal,
  ThumbsDown,
  Wrench,
} from 'lucide-react';
import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';

import type { AssistantMessage, Message, ToolCall } from '../data/workspace';
import { cn } from '../lib/cn';
import { Markdown } from './Markdown';

const TOOL_ICONS: Record<ToolCall['icon'], ComponentType<SVGProps<SVGSVGElement>>> = {
  wrench: Wrench,
  globe: Globe,
  folder: Folder,
  terminal: SquareTerminal,
};

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-7 px-6 pb-10 pt-2">
      {messages.map((message) =>
        message.role === 'user' ? (
          <UserMessage key={message.id} text={message.text} />
        ) : (
          <AssistantTurn key={message.id} message={message} />
        ),
      )}
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bubble px-4 py-2.5 text-[16px] leading-[1.5]">
        {text}
      </div>
    </div>
  );
}

function AssistantTurn({ message }: { message: AssistantMessage }) {
  const [workedOpen, setWorkedOpen] = useState(false);
  const [callsOpen, setCallsOpen] = useState(true);

  return (
    <div className="group/turn">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setWorkedOpen((value) => !value)}
          className="flex shrink-0 items-center gap-1 text-[13px] text-fg-tertiary hover:text-fg-secondary"
        >
          <span>Worked for {message.workedFor}</span>
          <ChevronDown
            className={cn('size-3.5 transition-transform', workedOpen && 'rotate-180')}
            strokeWidth={1.75}
          />
        </button>
        <div className="h-px flex-1 bg-line-subtle" />
      </div>

      {workedOpen ? (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setCallsOpen((value) => !value)}
            className="flex items-center gap-1 text-[14px] text-fg-secondary hover:text-fg"
          >
            <span>{message.activitySummary}</span>
            <ChevronDown
              className={cn('size-3.5 transition-transform', callsOpen && 'rotate-180')}
              strokeWidth={1.75}
            />
          </button>
          {callsOpen ? (
            <div className="mt-1.5 flex flex-col gap-px">
              {message.toolCalls.map((call) => (
                <ToolCallRow key={call.id} call={call} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <Markdown>{message.markdown}</Markdown>
      </div>

      <div className="mt-2 flex items-center gap-0.5 text-fg-tertiary opacity-0 transition-opacity group-hover/turn:opacity-100">
        <MessageAction label="Copy">
          <Copy className="size-3.5" strokeWidth={1.75} />
        </MessageAction>
        <MessageAction label="Bad response">
          <ThumbsDown className="size-3.5" strokeWidth={1.75} />
        </MessageAction>
        <MessageAction label="Branch from here">
          <GitBranch className="size-3.5" strokeWidth={1.75} />
        </MessageAction>
        <span className="ml-1.5 text-[12px]">{message.timestamp}</span>
      </div>
    </div>
  );
}

function ToolCallRow({ call }: { call: ToolCall }) {
  const Icon = TOOL_ICONS[call.icon];
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 py-[3px] text-[14px] text-fg-secondary',
        call.dimmed && 'opacity-40',
      )}
    >
      <Icon className="mt-[3px] size-4 shrink-0 text-fg-tertiary" strokeWidth={1.75} />
      <span className="min-w-0 break-words">{call.label}</span>
    </div>
  );
}

function MessageAction({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-6 items-center justify-center rounded-md hover:bg-hover hover:text-fg"
    >
      {children}
    </button>
  );
}
