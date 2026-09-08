import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import type { Model } from '@protocol/v2/Model';
import { cn } from '../lib/cn';
import type { ThemePreference } from '../lib/theme';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  models: Model[];
  selectedModelId: string | null;
  onModelChange: (id: string) => void;
  selectedEffort: string | null;
  onEffortChange: (effort: string) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsDialog({
  open,
  onClose,
  models,
  selectedModelId,
  onModelChange,
  selectedEffort,
  onEffortChange,
  theme,
  onThemeChange,
}: SettingsDialogProps) {
  const [draftModelId, setDraftModelId] = useState(selectedModelId);
  const [draftEffort, setDraftEffort] = useState(selectedEffort);
  const [draftTheme, setDraftTheme] = useState(theme);

  useEffect(() => {
    if (open) {
      setDraftModelId(selectedModelId);
      setDraftEffort(selectedEffort);
      setDraftTheme(theme);
    }
  }, [open, selectedModelId, selectedEffort, theme]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const draftModel = models.find((model) => model.id === draftModelId) ?? null;
  const efforts = draftModel
    ? draftModel.supportedReasoningEfforts.length > 0
      ? draftModel.supportedReasoningEfforts
      : [
          {
            reasoningEffort: draftModel.defaultReasoningEffort,
            description: 'Default for this model',
          },
        ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-[420px] max-w-full rounded-2xl border border-line bg-elevated p-6 shadow-2xl"
      >
        <h2 className="text-[17px] font-semibold">Settings</h2>

        <div className="mt-5 flex flex-col gap-4">
          <Field label="Model">
            <select
              value={draftModelId ?? ''}
              onChange={(event) => {
                const nextId = event.target.value;
                setDraftModelId(nextId);
                const nextModel = models.find((model) => model.id === nextId);
                setDraftEffort(nextModel?.defaultReasoningEffort ?? null);
              }}
              className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reasoning effort">
            <select
              value={draftEffort ?? ''}
              onChange={(event) => setDraftEffort(event.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
            >
              {efforts.map((option) => (
                <option key={option.reasoningEffort} value={option.reasoningEffort}>
                  {option.reasoningEffort}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Theme">
            <div className="flex gap-1.5">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = draftTheme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDraftTheme(option.value)}
                    className={cn(
                      'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[13px]',
                      selected
                        ? 'border-line-strong bg-active text-fg'
                        : 'border-line text-fg-secondary hover:bg-hover',
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={1.75} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-full border border-line px-4 text-[13px] hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (draftModelId) {
                onModelChange(draftModelId);
              }
              if (draftEffort) {
                onEffortChange(draftEffort);
              }
              onThemeChange(draftTheme);
              onClose();
            }}
            className="h-8 rounded-full bg-send px-4 text-[13px] text-send-fg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-fg-secondary">{label}</span>
      {children}
    </label>
  );
}
