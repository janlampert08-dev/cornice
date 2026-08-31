"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { GripHorizontal } from "lucide-react";

const DRAG_TAP_THRESHOLD_PX = 6;

// Gemeinsame Bottom-Sheet-Mechanik (Mobile): per Ziehgriff zwischen einer
// Peek- und einer (fast) Vollhöhe auf-/zuziehbar, reiner Tap schaltet um.
// Extrahiert aus ExploreView.tsx, damit dieselbe Geste konsistent auf
// mehreren Seiten läuft (Explore-Liste, Routendetail) statt der Algorithmus
// zweimal leicht unterschiedlich existiert. Ab md: display:contents, die
// Positionierung greift dort nicht mehr — der Aufrufer übernimmt ab md die
// gewohnte Liste/Detail-links, Karte-rechts-Aufteilung über eigene Klassen.
export default function DragSheet({
  containerRef,
  peekPx,
  expandedGapPx = 96,
  handleLabels,
  className = "",
  children,
}: {
  containerRef: RefObject<HTMLElement | null>;
  peekPx: number;
  expandedGapPx?: number;
  handleLabels: { expand: string; collapse: string };
  className?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);

  const sheetHeight = expanded ? `calc(100% - ${expandedGapPx}px)` : `${peekPx}px`;

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const containerHeight = containerRef.current?.clientHeight ?? window.innerHeight;
      const currentHeight = expanded ? containerHeight - expandedGapPx : peekPx;
      dragRef.current = { startY: e.clientY, startHeight: currentHeight, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [containerRef, expanded, expandedGapPx, peekPx],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaY = drag.startY - e.clientY;
      if (Math.abs(deltaY) > DRAG_TAP_THRESHOLD_PX) drag.moved = true;

      const containerHeight = containerRef.current?.clientHeight ?? window.innerHeight;
      const maxHeight = containerHeight - expandedGapPx;
      const next = Math.min(Math.max(drag.startHeight + deltaY, peekPx), maxHeight);
      setDragHeight(next);
    },
    [containerRef, expandedGapPx, peekPx],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);

      if (!drag) return;

      // Reiner Tap (kaum Bewegung) schaltet um, statt am aktuellen Zustand
      // festzuhalten — sonst müsste man aus der Peek-Position immer ziehen.
      if (!drag.moved) {
        setExpanded((current) => !current);
        setDragHeight(null);
        return;
      }

      const containerHeight = containerRef.current?.clientHeight ?? window.innerHeight;
      const maxHeight = containerHeight - expandedGapPx;
      const current = dragHeight ?? drag.startHeight;
      const midpoint = (peekPx + maxHeight) / 2;
      setExpanded(current > midpoint);
      setDragHeight(null);
    },
    [containerRef, dragHeight, expandedGapPx, peekPx],
  );

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-10 flex h-[var(--sheet-h)] flex-col overflow-hidden rounded-t-lg border-t border-border bg-background shadow-overlay md:contents ${
        dragHeight === null ? "transition-[height] duration-base ease-standard" : ""
      } ${className}`}
      style={{ "--sheet-h": dragHeight !== null ? `${dragHeight}px` : sheetHeight } as CSSProperties}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        tabIndex={0}
        aria-label={expanded ? handleLabels.collapse : handleLabels.expand}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded((current) => !current);
        }}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center rounded-t-lg py-2 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset md:hidden"
      >
        <GripHorizontal className="h-5 w-5 text-muted" aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}
