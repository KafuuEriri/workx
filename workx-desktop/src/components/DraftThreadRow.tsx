import { cn } from '../lib/cn';
import { useI18n } from '../lib/i18n';

export function DraftThreadRow({ indent = false }: { indent?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-current="true"
      className={cn(
        'flex h-[30px] items-center rounded-lg bg-active pr-8 text-[13px] text-fg',
        indent ? 'pl-[38px]' : 'pl-2.5',
      )}
    >
      <span className="truncate">{t('common.newChat')}</span>
    </div>
  );
}
