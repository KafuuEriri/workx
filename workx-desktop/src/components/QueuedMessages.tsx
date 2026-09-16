import { CornerDownRight, ListEnd, ListX, MessageCirclePlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { QueuedMessage } from '../app/useWorkx';
import { useI18n } from '../lib/i18n';
import { IconButton } from './IconButton';
import { Menu, MenuItem } from './Menu';

interface QueuedMessagesProps {
  messages: QueuedMessage[];
  disabled: boolean;
  queueing: boolean;
  onQueueingChange: (enabled: boolean) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onEditingChange: (id: string | null) => void;
  onSend: (id: string, destination: 'current' | 'side') => void;
}

export function QueuedMessages({ messages, disabled, queueing, onQueueingChange, onRemove, onEdit, onEditingChange, onSend }: QueuedMessagesProps) {
  const { t } = useI18n();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  if (messages.length === 0) {
    return null;
  }
  return (
    <section aria-label={t('queue.title')} className="relative mx-auto w-[calc(100%-1.5rem)] max-w-[40.5rem] rounded-t-2xl border border-b-0 border-line bg-composer px-2 pb-2 pt-1 text-[13px]">
      {messages.map((message) => (
        <div key={message.id} className="relative flex min-h-9 items-center gap-2 px-1">
          <ListEnd className="size-3.5 shrink-0 text-fg-tertiary" strokeWidth={1.5} />
          {editing?.id === message.id ? (
            <div className="flex min-w-0 flex-1 flex-col gap-2 py-2">
              <textarea aria-label={t('queue.edit')} autoFocus value={editing.text}
                onChange={(event) => setEditing({ id: message.id, text: event.target.value })}
                className="max-h-40 min-h-16 w-full resize-y rounded-lg border border-line bg-transparent p-2 outline-none focus:border-line-strong" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setEditing(null); onEditingChange(null); }}>{t('common.cancel')}</button>
                <button type="button" disabled={disabled || (!editing.text.trim() && message.images.length === 0)}
                  onClick={() => { onEdit(message.id, editing.text.trim()); setEditing(null); onEditingChange(null); }}
                  className="disabled:opacity-40">{t('common.save')}</button>
              </div>
            </div>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate" title={message.text}>{message.text || t('queue.images', { count: message.images.length })}</span>
              {message.text && message.images.length > 0 ? <span className="text-fg-tertiary">{t('queue.images', { count: message.images.length })}</span> : null}
              <button type="button" disabled={disabled} onClick={() => onSend(message.id, 'current')}
                className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-fg-tertiary hover:bg-hover hover:text-fg disabled:opacity-40">
                <CornerDownRight className="size-3.5" strokeWidth={1.5} />{t('composer.steer')}
              </button>
              <IconButton size="sm" disabled={disabled} aria-label={t('queue.remove')} onClick={() => onRemove(message.id)}>
                <Trash2 className="size-3.5" strokeWidth={1.5} />
              </IconButton>
              <div className="relative">
                <IconButton size="sm" disabled={disabled} aria-label={t('queue.more')} aria-expanded={menuId === message.id}
                  onClick={() => setMenuId(menuId === message.id ? null : message.id)}>
                  <MoreHorizontal className="size-4" />
                </IconButton>
                <Menu open={menuId === message.id && !disabled} onClose={() => setMenuId(null)} align="right">
                  <MenuItem title={t('queue.edit')} icon={<Pencil className="size-3.5" />} onClick={() => { setEditing({ id: message.id, text: message.text }); onEditingChange(message.id); setMenuId(null); }} />
                  <MenuItem title={t('queue.sideChat')} icon={<MessageCirclePlus className="size-3.5" />} onClick={() => { onSend(message.id, 'side'); setMenuId(null); }} />
                  <MenuItem title={t(queueing ? 'queue.disable' : 'queue.enable')} icon={<ListX className="size-3.5" />} onClick={() => { onQueueingChange(!queueing); setMenuId(null); }} />
                </Menu>
              </div>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
