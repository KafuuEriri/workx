import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import {
  MODEL_OPTIONS,
  REASONING_EFFORTS,
  type ModelOption,
} from '../data/workspace';
import type { ThemePreference } from '../lib/theme';
import { cn } from '../lib/cn';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  provider: string;
  onProviderChange: (provider: string) => void;
  model: ModelOption;
  onModelChange: (model: ModelOption) => void;
  reasoning: string;
  onReasoningChange: (reasoning: string) => void;
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
  provider,
  onProviderChange,
  model,
  onModelChange,
  reasoning,
  onReasoningChange,
  theme,
  onThemeChange,
}: SettingsDialogProps) {
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
          <Field label="Provider">
            <input
              value={provider}
              onChange={(event) => onProviderChange(event.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-app px-3 text-[14px] outline-none focus:border-line-strong"
            />
          </Field>

          <Field label="Model">
            <select
              value={model.id}
              onChange={(event) => {
                const next = MODEL_OPTIONS.find((option) => option.id === event.target.value);
                if (next) {
                  onModelChange(next);
                }
              }}
              className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reasoning effort">
            <select
              value={reasoning}
              onChange={(event) => onReasoningChange(event.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
            >
              {REASONING_EFFORTS.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Theme">
            <div className="flex gap-1.5">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onThemeChange(option.value)}
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
            onClick={onClose}
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
