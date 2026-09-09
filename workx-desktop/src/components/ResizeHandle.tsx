import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface ResizeHandleProps {
  side: 'left' | 'right';
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  label: string;
}

/**
 * A one-pixel divider that doubles as a drag handle. The visible line is the
 * element itself; an invisible, wider child extends the pointer hit area so
 * hovering never renders a second line next to an existing border.
 */
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
      className="group relative z-20 w-px shrink-0 cursor-col-resize select-none bg-line-subtle transition-colors hover:bg-line-strong"
    >
      <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
    </div>
  );
}
