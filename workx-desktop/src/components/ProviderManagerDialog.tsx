import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import {
  BUILTIN_MODEL_PROVIDER_IDS,
  type ProviderConfig,
  type ProviderWireApi,
} from '../app/useWorkx';
import { cn } from '../lib/cn';
import { useI18n } from '../lib/i18n';

interface ProviderManagerDialogProps {
  open: boolean;
  onClose: () => void;
  providerConfigs: Record<string, ProviderConfig>;
  onSave: (id: string, config: ProviderConfig) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface ProviderDraft {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  envKey: string;
  wireApi: ProviderWireApi;
  modelsEndpoint: string;
  customModels: string;
}

const EMPTY_DRAFT: ProviderDraft = {
  id: '',
  name: '',
  baseUrl: '',
  apiKey: '',
  envKey: '',
  wireApi: 'responses',
  modelsEndpoint: '',
  customModels: '',
};

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const WIRE_API_OPTIONS: ProviderWireApi[] = ['responses', 'chat', 'auto'];

function draftFromConfig(id: string, config: ProviderConfig): ProviderDraft {
  return {
    id,
    name: config.name,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    envKey: config.envKey,
    wireApi: config.wireApi,
    modelsEndpoint: config.modelsEndpoint,
    customModels: config.customModels.join('\n'),
  };
}

export function ProviderManagerDialog({
  open,
  onClose,
  providerConfigs,
  onSave,
  onDelete,
}: ProviderManagerDialogProps) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProviderDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const configuredIds = Object.keys(providerConfigs).sort();

  useEffect(() => {
    if (!open) {
      return;
    }
    const first = Object.keys(providerConfigs).sort()[0];
    if (first) {
      setSelectedId(first);
      setDraft(draftFromConfig(first, providerConfigs[first]));
    } else {
      setSelectedId(null);
      setDraft(EMPTY_DRAFT);
    }
    setError(null);
    setBusy(false);
    setConfirmDelete(false);
    // Reset only when the dialog opens; edits must survive parent re-renders.
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (confirmDelete) {
        setConfirmDelete(false);
      } else {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirmDelete, open, onClose]);

  if (!open) {
    return null;
  }

  const select = (id: string) => {
    setSelectedId(id);
    setDraft(draftFromConfig(id, providerConfigs[id]));
    setError(null);
    setConfirmDelete(false);
  };

  const startNew = () => {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setConfirmDelete(false);
  };

  const handleSave = async () => {
    const id = draft.id.trim();
    if (selectedId === null) {
      if (!id) {
        setError(t('provider.idRequired'));
        return;
      }
      if (!PROVIDER_ID_PATTERN.test(id)) {
        setError(t('provider.idInvalid'));
        return;
      }
      if (BUILTIN_MODEL_PROVIDER_IDS.includes(id)) {
        setError(t('provider.idReserved', { id }));
        return;
      }
    }
    if (!draft.baseUrl.trim()) {
      setError(t('provider.baseUrlRequired'));
      return;
    }
    const targetId = selectedId ?? id;
    const config: ProviderConfig = {
      name: draft.name.trim() || targetId,
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      envKey: draft.envKey.trim(),
      wireApi: draft.wireApi,
      modelsEndpoint: draft.modelsEndpoint.trim(),
      customModels: draft.customModels
        .split(/[\n,]+/)
        .map((model) => model.trim())
        .filter(Boolean),
    };
    setBusy(true);
    try {
      await onSave(targetId, config);
      onClose();
    } catch (saveError) {
      setError(
        t('provider.saveFailed', {
          message: saveError instanceof Error ? saveError.message : String(saveError),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) {
      return;
    }
    const removed = selectedId;
    setBusy(true);
    try {
      await onDelete(removed);
      const remaining = configuredIds.filter((id) => id !== removed);
      if (remaining.length > 0) {
        setSelectedId(remaining[0]);
        setDraft(draftFromConfig(remaining[0], providerConfigs[remaining[0]]));
      } else {
        setSelectedId(null);
        setDraft(EMPTY_DRAFT);
      }
      setError(null);
      setConfirmDelete(false);
    } catch (deleteError) {
      setError(
        t('provider.deleteFailed', {
          message: deleteError instanceof Error ? deleteError.message : String(deleteError),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('provider.title')}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-[600px] w-[760px] max-w-full overflow-hidden rounded-2xl border border-line bg-elevated shadow-2xl"
      >
        <div className="flex w-[230px] shrink-0 flex-col border-r border-line bg-app">
          <h2 className="px-4 pt-4 pb-3 text-[15px] font-semibold">{t('provider.title')}</h2>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {configuredIds.map((id) => {
              const config = providerConfigs[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => select(id)}
                  className={cn(
                    'flex w-full flex-col rounded-lg px-2.5 py-2 text-left',
                    id === selectedId ? 'bg-active' : 'hover:bg-hover',
                  )}
                >
                  <span className="truncate text-[13px]">{config.name || id}</span>
                  <span className="truncate text-[11px] text-fg-tertiary">{id}</span>
                </button>
              );
            })}
            {configuredIds.length === 0 ? (
              <p className="px-2.5 py-2 text-[12px] leading-snug text-fg-tertiary">
                {t('provider.empty')}
              </p>
            ) : null}
          </div>
          <div className="border-t border-line p-2">
            <button
              type="button"
              onClick={startNew}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px]',
                selectedId === null ? 'bg-active' : 'hover:bg-hover',
              )}
            >
              <Plus className="size-4 shrink-0" strokeWidth={1.75} />
              {t('provider.add')}
            </button>
          </div>
          <p className="border-t border-line px-3 py-2 text-[11px] leading-snug text-fg-tertiary">
            {t('provider.builtinNote')}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="flex flex-col gap-4">
              <Field
                label={t('provider.id')}
                hint={selectedId === null ? t('provider.idHint') : undefined}
              >
                <input
                  value={draft.id}
                  disabled={selectedId !== null}
                  onChange={(event) => setDraft({ ...draft, id: event.target.value })}
                  placeholder="my-provider"
                  className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong disabled:opacity-60"
                />
              </Field>

              <Field label={t('provider.name')}>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder={draft.id || 'My provider'}
                  className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
                />
              </Field>

              <Field label={t('provider.baseUrl')}>
                <input
                  value={draft.baseUrl}
                  onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
                />
              </Field>

              <Field label={t('provider.apiKey')} hint={t('provider.apiKeyHint')}>
                <input
                  type="password"
                  value={draft.apiKey}
                  onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                  placeholder="sk-…"
                  className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
                />
              </Field>

              <Field label={t('provider.envKey')} hint={t('provider.envKeyHint')}>
                <input
                  value={draft.envKey}
                  onChange={(event) => setDraft({ ...draft, envKey: event.target.value })}
                  placeholder="MY_PROVIDER_API_KEY"
                  className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
                />
              </Field>

              <Field label={t('provider.wireApi')}>
                <select
                  value={draft.wireApi}
                  onChange={(event) =>
                    setDraft({ ...draft, wireApi: event.target.value as ProviderWireApi })
                  }
                  className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
                >
                  {WIRE_API_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`provider.wireApi.${option}`)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('provider.modelsEndpoint')} hint={t('provider.modelsEndpointHint')}>
                <input
                  value={draft.modelsEndpoint}
                  onChange={(event) =>
                    setDraft({ ...draft, modelsEndpoint: event.target.value })
                  }
                  placeholder="/v1/models"
                  className="h-9 w-full rounded-lg border border-line bg-app px-2.5 text-[14px] outline-none focus:border-line-strong"
                />
              </Field>

              <Field label={t('provider.customModels')} hint={t('provider.customModelsHint')}>
                <textarea
                  value={draft.customModels}
                  onChange={(event) =>
                    setDraft({ ...draft, customModels: event.target.value })
                  }
                  rows={3}
                  placeholder="deepseek-chat&#10;deepseek-reasoner"
                  className="w-full resize-none rounded-lg border border-line bg-app px-2.5 py-2 text-[14px] outline-none focus:border-line-strong"
                />
              </Field>
            </div>
          </div>

          {error ? (
            <p className="border-t border-line bg-danger/5 px-5 py-2 text-[12px] leading-snug text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
            <div className="min-w-0">
              {selectedId ? (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12px] text-fg-secondary">
                      {t('provider.deleteConfirm', {
                        name: providerConfigs[selectedId]?.name || selectedId,
                      })}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete()}
                      className="h-8 shrink-0 rounded-lg px-2.5 text-[13px] text-danger hover:bg-hover disabled:opacity-60"
                    >
                      {t('common.delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="h-8 shrink-0 rounded-lg px-2.5 text-[13px] text-fg-secondary hover:bg-hover"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-danger hover:bg-hover"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    {t('common.delete')}
                  </button>
                )
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-8 rounded-full border border-line px-4 text-[13px] hover:bg-hover"
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSave()}
                className="h-8 rounded-full bg-send px-4 text-[13px] text-send-fg disabled:opacity-60"
              >
                {busy ? t('provider.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-fg-secondary">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-fg-tertiary">{hint}</span> : null}
    </label>
  );
}
