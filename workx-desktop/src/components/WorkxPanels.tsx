import { Loader2, Plug, Puzzle, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';

import type { MarketplaceLoadErrorInfo } from '@protocol/v2/MarketplaceLoadErrorInfo';
import type { McpServerStatus } from '@protocol/v2/McpServerStatus';
import type { PluginMarketplaceEntry } from '@protocol/v2/PluginMarketplaceEntry';
import type { SkillErrorInfo } from '@protocol/v2/SkillErrorInfo';
import type { SkillMetadata } from '@protocol/v2/SkillMetadata';
import { cn } from '../lib/cn';
import { useI18n } from '../lib/i18n';

interface PanelShellProps {
  title: string;
  description: string;
  loading: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}

function PanelShell({ title, description, loading, onRefresh, children }: PanelShellProps) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-5 px-8 py-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-semibold">{title}</h1>
          <p className="mt-1 text-[13px] text-fg-tertiary">{description}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] text-fg-secondary hover:bg-hover disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <RefreshCw className="size-3.5" strokeWidth={1.75} />
          )}
          {t('common.refresh')}
        </button>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-line-subtle px-4 py-6 text-[13px] text-fg-tertiary">{children}</p>;
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-[13px] text-warning">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 break-words">{message}</span>
    </div>
  );
}

export function PluginsPanel({
  marketplaces,
  errors,
  loading,
  onRefresh,
}: {
  marketplaces: PluginMarketplaceEntry[];
  errors: MarketplaceLoadErrorInfo[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const plugins = marketplaces.flatMap((marketplace) =>
    marketplace.plugins.map((plugin) => ({ marketplace, plugin })),
  );
  const { t } = useI18n();

  return (
    <PanelShell
      title={t('panels.plugins.title')}
      description={t('panels.plugins.description')}
      loading={loading}
      onRefresh={onRefresh}
    >
      {errors.map((error) => (
        <ErrorNote key={`${error.marketplacePath}-${error.message}`} message={error.message} />
      ))}

      {plugins.length === 0 ? (
        <Empty>{t('panels.plugins.empty')}</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {plugins.map(({ marketplace, plugin }) => (
            <div
              key={`${marketplace.name}-${plugin.id}`}
              className="flex items-start gap-3 rounded-xl border border-line-subtle px-4 py-3"
            >
              <Puzzle className="mt-0.5 size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium">
                    {plugin.interface?.displayName ?? plugin.name}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[11px]',
                      plugin.installed
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-hover text-fg-tertiary',
                    )}
                  >
                    {plugin.installed
                      ? plugin.enabled
                        ? t('common.installed')
                        : t('common.disabled')
                      : t('common.available')}
                  </span>
                </div>
                {plugin.interface?.shortDescription ?? plugin.interface?.longDescription ? (
                  <p className="mt-0.5 text-[13px] text-fg-tertiary">
                    {plugin.interface?.shortDescription ?? plugin.interface?.longDescription}
                  </p>
                ) : null}
                <p className="mt-1 text-[12px] text-fg-tertiary">{marketplace.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

export function SkillsPanel({
  skills,
  errors,
  loading,
  onRefresh,
}: {
  skills: SkillMetadata[];
  errors: SkillErrorInfo[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  return (
    <PanelShell
      title={t('panels.skills.title')}
      description={t('panels.skills.description')}
      loading={loading}
      onRefresh={onRefresh}
    >
      {errors.map((error) => (
        <ErrorNote key={`${error.path}-${error.message}`} message={error.message} />
      ))}

      {skills.length === 0 ? (
        <Empty>{t('panels.skills.empty')}</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {skills.map((skill) => (
            <div
              key={`${skill.scope}-${skill.name}`}
              className="flex items-start gap-3 rounded-xl border border-line-subtle px-4 py-3"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium">{skill.name}</span>
                  {!skill.enabled ? (
                    <span className="rounded-full bg-hover px-1.5 py-px text-[11px] text-fg-tertiary">
                      {t('common.disabled')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-3 text-[13px] text-fg-tertiary">
                  {skill.description}
                </p>
                <p className="mt-1 truncate font-mono text-[12px] text-fg-tertiary">{skill.path}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

export function McpPanel({
  servers,
  loading,
  onRefresh,
}: {
  servers: McpServerStatus[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  return (
    <PanelShell
      title={t('panels.mcp.title')}
      description={t('panels.mcp.description')}
      loading={loading}
      onRefresh={onRefresh}
    >
      {servers.length === 0 ? (
        <Empty>{t('panels.mcp.empty')}</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {servers.map((server) => {
            const toolCount = Object.keys(server.tools).length;
            return (
              <div
                key={server.name}
                className="flex items-start gap-3 rounded-xl border border-line-subtle px-4 py-3"
              >
                <Plug className="mt-0.5 size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium">{server.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px text-[11px]',
                        server.runtimeStatus === 'connected'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-hover text-fg-tertiary',
                      )}
                    >
                      {server.runtimeStatus ?? t('common.unknown')}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-fg-tertiary">
                    {t(toolCount === 1 ? 'common.tool' : 'common.tools', { count: toolCount })} ·{' '}
                    {t('common.auth', { status: server.authStatus })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}
