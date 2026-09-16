import { ArrowUp, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWorkx, type QueuedMessage } from '../app/useWorkx';
import { useI18n } from '../lib/i18n';
import { IconButton } from './IconButton';
import { MessageList } from './MessageList';
import type { FileUpdateChange } from '@protocol/v2/FileUpdateChange';

interface SideChatProps {
  threadId: string;
  /// 打开面板后要投递的排队消息。快捷键打开的新分支不带消息。
  message: QueuedMessage | null;
  onClose: () => void;
  onUndoFileChange: (change: FileUpdateChange) => Promise<void> | void;
  onReviewFileChange: (change: FileUpdateChange) => void;
}

export function SideChat({ threadId, message, onClose, onUndoFileChange, onReviewFileChange }: SideChatProps) {
  const chat = useWorkx();
  const { t } = useI18n();
  const [text, setText] = useState('');
  const opened = useRef<string | null>(null);
  const delivered = useRef(false);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chat.status === 'ready' && opened.current !== threadId) {
      opened.current = threadId;
      void chat.openThread(threadId);
    }
  }, [chat.status, chat.openThread, threadId]);
  // 分支必须先订阅，否则消息开头的流式事件会丢在面板打开之前。
  useEffect(() => {
    if (delivered.current || !message || chat.activeThread?.id !== threadId) {
      return;
    }
    delivered.current = true;
    void chat.sendInput(message.input, message.text, message.images, { asGoal: message.asGoal });
  }, [chat, message, threadId]);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [chat.transcript]);
  return (
    <aside aria-label={t('queue.sideChat')} className="flex h-full w-[min(42rem,45vw)] min-w-80 shrink-0 flex-col border-l border-line bg-app">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 text-sm">
        <span>{t('queue.sideChat')}</span>
        <IconButton aria-label={t('common.close')} onClick={onClose}><X className="size-4" /></IconButton>
      </header>
      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto pt-4">
        <MessageList entries={chat.transcript} running={chat.running} error={chat.error ?? chat.statusMessage}
          warnings={chat.warnings} approvals={chat.approvals} cwd={chat.cwd} writerConflict={chat.writerConflict}
          onResolveApproval={(id, decision) => void chat.resolveApproval(id, decision)}
          onDismissError={chat.dismissError} onRetryWriter={() => void chat.retryActiveThread()}
          onBranch={(turnId) => void chat.forkThread(turnId)}
          onUndoFileChange={onUndoFileChange} onReviewFileChange={onReviewFileChange} />
      </div>
      <form className="m-4 rounded-2xl border border-line bg-composer p-3" onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim() || !chat.activeThread || chat.writerConflict) return;
        void chat.sendMessage(text.trim(), [], [], { steer: true });
        setText('');
      }}>
        <textarea aria-label={t('composer.placeholder')} placeholder={t('composer.placeholder')}
          value={text} onChange={(event) => setText(event.target.value)}
          disabled={!chat.activeThread || chat.writerConflict}
          className="w-full resize-none bg-transparent text-sm outline-none" />
        <div className="flex justify-end gap-2">
          {chat.running ? <IconButton aria-label={t('composer.stop')} onClick={() => void chat.interrupt()}><Square className="size-4" /></IconButton> : null}
          <button type="submit" aria-label={t('composer.send')} disabled={!text.trim() || !chat.activeThread || chat.writerConflict}
            className="flex size-8 items-center justify-center rounded-full bg-fg text-app disabled:opacity-30"><ArrowUp className="size-4" /></button>
        </div>
      </form>
    </aside>
  );
}
