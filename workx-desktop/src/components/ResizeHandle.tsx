import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface ResizeHandleProps {
  side: 'left' | 'right';
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  label: string;
}

export function ResizeHandle({ side, width, min, max, onResize, label }: ResizeHandleProps) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    const delta = event.clientX - drag.current.startX;
    const next = side === 'left' ? drag.current.startWidth + delta : drag.current.startWidth - delta;
    onResize(Math.min(max, Math.max(min, next)));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onResize(side === 'left' ? 275 : 460)}
      className="group relative z-20 w-1 shrink-0 cursor-col-resize select-none bg-transparent"
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-line-strong" />
    </div>
  );
}
