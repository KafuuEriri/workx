import type { LucideIcon } from 'lucide-react';

import type { ComposerMenuBinding } from '../data/composerMenu';
import { cn } from '../lib/cn';
import { useI18n } from '../lib/i18n';

export interface ComposerMenuItem {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  icon: LucideIcon;
  insertText: string;
  binding?: ComposerMenuBinding;
  commandId?: string;
}

export interface ComposerMenuSection {
  id: string;
  label: string;
  hint?: string;
  items: ComposerMenuItem[];
}

interface ComposerMenuProps {
  sections: ComposerMenuSection[];
  activeId: string | null;
  loading: boolean;
  emptyLabel: string;
  onHover: (id: string) => void;
  onSelect: (item: ComposerMenuItem) => void;
  onDismiss: () => void;
}

export function ComposerMenu({
  sections,
  activeId,
  loading,
  emptyLabel,
  onHover,
  onSelect,
  onDismiss,
}: ComposerMenuProps) {
  const { t } = useI18n();
  const hasItems = sections.some((section) => section.items.length > 0);
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onDismiss} />
      <div
        role="listbox"
        className="absolute bottom-full left-0 z-50 mb-2 max-h-[340px] w-full overflow-y-auto rounded-xl border border-line bg-elevated p-1.5 shadow-xl"
      >
        {loading && !hasItems ? (
          <p className="px-2.5 py-2 text-[13px] text-fg-tertiary">
            {t('composer.searching')}
          </p>
        ) : null}
        {!loading && !hasItems ? (
          <p className="px-2.5 py-2 text-[13px] text-fg-tertiary">{emptyLabel}</p>
        ) : null}
        {sections.map((section) => {
          if (section.items.length === 0 && !section.hint) {
            return null;
          }
          return (
            <div key={section.id} className="mb-1 last:mb-0">
              <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-fg-tertiary">
                {section.label}
              </div>
              {section.items.length === 0 ? (
                <p className="px-2.5 pb-1 text-[13px] text-fg-tertiary">{section.hint}</p>
              ) : (
                section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={item.id === activeId}
                      onMouseEnter={() => onHover(item.id)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSelect(item);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left',
                        item.id === activeId ? 'bg-hover' : 'hover:bg-hover',
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">{item.title}</span>
                        {item.description ? (
                          <span className="block truncate text-[12px] text-fg-tertiary">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      {item.meta ? (
                        <span className="shrink-0 text-[12px] text-fg-tertiary">{item.meta}</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
