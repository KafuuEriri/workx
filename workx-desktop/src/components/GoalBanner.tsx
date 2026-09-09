import { Maximize2, Pause, Play, Target, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ThreadGoal } from '@protocol/v2/ThreadGoal';
import { useI18n, type MessageKey } from '../lib/i18n';
import { IconButton } from './IconButton';

export function formatGoalElapsed(seconds: number): string {
  const total = Math.max(0, Math.trunc(seconds));
  if (total < 60) {
    return `${total}s`;
  }
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${remainingMinutes}m`;
  }
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

const STATUS_KEYS: Record<ThreadGoal['status'], MessageKey> = {
  active: 'goal.pursuing',
  paused: 'goal.paused',
  blocked: 'goal.blocked',
  usageLimited: 'goal.usageLimited',
  budgetLimited: 'goal.budgetLimited',
  complete: 'goal.complete',
};

interface GoalBannerProps {
  goal: ThreadGoal;
  onClear: () => void;
  onTogglePause: () => void;
  onExpand: () => void;
}

export function GoalBanner({ goal, onClear, onTogglePause, onExpand }: GoalBannerProps) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const baselineRef = useRef({ at: Date.now(), seconds: goal.timeUsedSeconds });

  useEffect(() => {
    baselineRef.current = { at: Date.now(), seconds: goal.timeUsedSeconds };
  }, [goal.createdAt, goal.timeUsedSeconds, goal.updatedAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed =
    goal.status === 'active'
      ? baselineRef.current.seconds +
        Math.floor((now - baselineRef.current.at) / 1000)
      : goal.timeUsedSeconds;
  const paused = goal.status === 'paused';

  return (
    <div className="mx-auto w-full max-w-[42rem] px-6">
      <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-2.5 shadow-sm">
        <Target className="size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[14px] font-medium">{t(STATUS_KEYS[goal.status])}</span>
          <span className="min-w-0 truncate text-[14px] text-fg-secondary">{goal.objective}</span>
          <span className="shrink-0 text-[13px] text-fg-tertiary">
            · {formatGoalElapsed(elapsed)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton aria-label={t('goal.clear')} onClick={onClear}>
            <Trash2 className="size-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton
            aria-label={paused ? t('goal.resume') : t('goal.pause')}
            onClick={onTogglePause}
          >
            {paused ? (
              <Play className="size-4" strokeWidth={1.75} />
            ) : (
              <Pause className="size-4" strokeWidth={1.75} />
            )}
          </IconButton>
          <IconButton aria-label={t('goal.details')} onClick={onExpand}>
            <Maximize2 className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
