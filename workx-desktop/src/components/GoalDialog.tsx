import { useEffect, useState } from 'react';

import type { ThreadGoal } from '@protocol/v2/ThreadGoal';
import { useI18n, type MessageKey } from '../lib/i18n';
import { formatGoalElapsed } from './GoalBanner';

const STATUS_KEYS: Record<ThreadGoal['status'], MessageKey> = {
  active: 'goal.pursuing',
  paused: 'goal.paused',
  blocked: 'goal.blocked',
  usageLimited: 'goal.usageLimited',
  budgetLimited: 'goal.budgetLimited',
  complete: 'goal.complete',
};

function formatTokens(value: number): string {
  if (value < 1000) {
    return String(value);
  }
  if (value < 1_000_000) {
    return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`;
  }
  return `${(value / 1_000_000).toFixed(1)}M`;
}

interface GoalDialogProps {
  open: boolean;
  goal: ThreadGoal | null;
  onClose: () => void;
  onSave: (objective: string) => Promise<void>;
  onClear: () => Promise<void>;
}

export function GoalDialog({ open, goal, onClose, onSave, onClear }: GoalDialogProps) {
  const { t } = useI18n();
  const [objective, setObjective] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setObjective(goal?.objective ?? '');
      setBusy(false);
    }
  }, [goal, open]);

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

  const trimmed = objective.trim();
  const canSave = trimmed.length > 0 && trimmed !== goal?.objective && !busy;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      onClose();
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
        aria-label={goal === null ? t('goal.setTitle') : t('goal.details')}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-[520px] max-w-full rounded-2xl border border-line bg-elevated p-5 shadow-2xl"
      >
        <h2 className="text-[17px] font-semibold">
          {goal === null ? t('goal.setTitle') : t('goal.details')}
        </h2>
        {goal === null ? (
          <>
            <p className="mt-2 text-[13px] text-fg-secondary">{t('goal.setHint')}</p>
            <label className="mt-4 block text-[13px] font-medium text-fg-secondary">
              {t('goal.objective')}
            </label>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              rows={4}
              className="mt-1.5 w-full resize-none rounded-xl border border-line bg-app px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-line-strong"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 items-center rounded-lg px-3 text-[14px] text-fg-secondary hover:bg-hover"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={() => void run(() => onSave(trimmed))}
                className="flex h-9 items-center rounded-lg bg-fg px-3.5 text-[14px] font-medium text-app hover:opacity-90 disabled:opacity-40"
              >
                {t('common.save')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-fg-secondary">
              <span>{t(STATUS_KEYS[goal.status])}</span>
              <span className="text-fg-tertiary">
                · {formatGoalElapsed(goal.timeUsedSeconds)}
              </span>
              {goal.tokenBudget !== null ? (
                <span className="text-fg-tertiary">
                  · {formatTokens(goal.tokensUsed)} / {formatTokens(goal.tokenBudget)}
                </span>
              ) : null}
            </div>
            <label className="mt-4 block text-[13px] font-medium text-fg-secondary">
              {t('goal.objective')}
            </label>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              rows={4}
              className="mt-1.5 w-full resize-none rounded-xl border border-line bg-app px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-line-strong"
            />
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(onClear)}
                className="flex h-9 items-center rounded-lg px-3 text-[14px] text-danger hover:bg-danger/10 disabled:opacity-40"
              >
                {t('goal.clear')}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 items-center rounded-lg px-3 text-[14px] text-fg-secondary hover:bg-hover"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => void run(() => onSave(trimmed))}
                  className="flex h-9 items-center rounded-lg bg-fg px-3.5 text-[14px] font-medium text-app hover:opacity-90 disabled:opacity-40"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
