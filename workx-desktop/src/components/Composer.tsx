import { AlertTriangle, ArrowUp, ChevronDown, Mic, Plus, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Model } from '@protocol/v2/Model';
import { PERMISSION_MODES, type PermissionMode } from '../data/workspace';
import { cn } from '../lib/cn';
import { IconButton } from './IconButton';
import { Menu, MenuItem } from './Menu';

interface ComposerProps {
  models: Model[];
  selectedModelId: string | null;
  onModelChange: (id: string) => void;
  providers: string[];
  providerId: string | null;
  providerBusy: boolean;
  onProviderChange: (id: string) => void;
  permission: PermissionMode;
  onPermissionChange: (mode: PermissionMode) => void;
  running: boolean;
  disabled: boolean;
  disabledPlaceholder?: string;
  onSubmit: (text: string) => void;
  onInterrupt: () => void;
}

export function Composer({
  models,
  selectedModelId,
  onModelChange,
  providers,
  providerId,
  providerBusy,
  onProviderChange,
  permission,
  onPermissionChange,
  running,
  disabled,
  disabledPlaceholder,
  onSubmit,
  onInterrupt,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [modelOpen, setModelOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  }, [value]);

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;

  return (
    <div className="shrink-0 px-6 pb-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = value.trim();
          if (!trimmed || disabled) {
            return;
          }
          onSubmit(trimmed);
          setValue('');
        }}
        className="mx-auto w-full max-w-[42rem] rounded-3xl border border-line bg-composer shadow-[var(--elevation-composer)] transition-colors focus-within:border-line-strong"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={
            disabled ? (disabledPlaceholder ?? 'Connecting to app-server…') : 'Do anything'
          }
          className="max-h-[240px] w-full resize-none bg-transparent px-4 pt-3.5 text-[16px] leading-[1.5] outline-none placeholder:text-fg-tertiary disabled:opacity-60"
        />

        <div className="flex items-center gap-1 px-3 pb-2.5 pt-0.5">
          <IconButton aria-label="Add attachment" disabled={disabled}>
            <Plus className="size-4" strokeWidth={1.75} />
          </IconButton>

          <div className="relative">
            <button
              type="button"
              onClick={() => setPermissionOpen((open) => !open)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[13px] hover:bg-hover',
                permission.warning ? 'text-warning' : 'text-fg-secondary',
              )}
            >
              {permission.warning ? (
                <AlertTriangle className="size-3.5" strokeWidth={1.75} />
              ) : null}
              {permission.label}
            </button>
            <Menu open={permissionOpen} onClose={() => setPermissionOpen(false)}>
              {PERMISSION_MODES.map((mode) => (
                <MenuItem
                  key={mode.id}
                  title={mode.label}
                  description={mode.description}
                  selected={mode.id === permission.id}
                  onClick={() => {
                    onPermissionChange(mode);
                    setPermissionOpen(false);
                  }}
                />
              ))}
            </Menu>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                disabled={providerBusy}
                onClick={() => setProviderOpen((open) => !open)}
                className="flex h-7 items-center gap-1 rounded-md px-2 text-[13px] text-fg-secondary hover:bg-hover disabled:opacity-60"
              >
                <span className="max-w-[140px] truncate">
                  {providerId ?? 'Provider'}
                </span>
                <ChevronDown className="size-3.5 shrink-0" strokeWidth={1.75} />
              </button>
              <Menu
                open={providerOpen}
                onClose={() => setProviderOpen(false)}
                align="right"
              >
                {providers.map((id) => (
                  <MenuItem
                    key={id}
                    title={id}
                    selected={id === providerId}
                    onClick={() => {
                      onProviderChange(id);
                      setProviderOpen(false);
                    }}
                  />
                ))}
              </Menu>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setModelOpen((open) => !open)}
                className="flex h-7 items-center gap-1 rounded-md px-2 text-[13px] text-fg-secondary hover:bg-hover"
              >
                <span className="max-w-[180px] truncate">
                  {selectedModel?.displayName ?? selectedModelId ?? 'Model'}
                </span>
                <ChevronDown className="size-3.5 shrink-0" strokeWidth={1.75} />
              </button>
              <Menu open={modelOpen} onClose={() => setModelOpen(false)} align="right">
                {models.map((model) => (
                  <MenuItem
                    key={model.id}
                    title={model.displayName}
                    description={model.description}
                    selected={model.id === selectedModelId}
                    onClick={() => {
                      onModelChange(model.id);
                      setModelOpen(false);
                    }}
                  />
                ))}
              </Menu>
            </div>

            <IconButton aria-label="Dictate">
              <Mic className="size-4" strokeWidth={1.75} />
            </IconButton>

            {running ? (
              <button
                type="button"
                onClick={onInterrupt}
                aria-label="Stop"
                className="flex size-8 items-center justify-center rounded-full bg-send text-send-fg"
              >
                <Square className="size-3.5" strokeWidth={2} />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send"
                disabled={value.trim().length === 0 || disabled}
                className="flex size-8 items-center justify-center rounded-full bg-send text-send-fg transition-opacity disabled:opacity-30"
              >
                <ArrowUp className="size-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
