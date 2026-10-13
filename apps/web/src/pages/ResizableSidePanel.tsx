// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { t } from "@lingui/core/macro";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "marketbot:right-panel-width";
const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 384;
const ABSOLUTE_MAX = 1000;
/** Desktop bots sidebar width (`md:w-[316px]` in Shell). */
const BOTS_SIDEBAR_WIDTH = 316;
const MIN_CHAT_WIDTH = 320;

function maximumWidth(reservedLeadingPx: number) {
  return Math.max(
    MIN_WIDTH,
    Math.min(ABSOLUTE_MAX, window.innerWidth - reservedLeadingPx - MIN_CHAT_WIDTH),
  );
}

function readPreferredWidth() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved >= MIN_WIDTH) return Math.min(ABSOLUTE_MAX, saved);
  } catch {
    /* Storage may be disabled. */
  }
  return DEFAULT_WIDTH;
}

export function ResizableSidePanel({
  open,
  panel,
  botsSidebarCollapsed = false,
  children,
}: {
  open: boolean;
  panel: string;
  botsSidebarCollapsed?: boolean;
  children: ReactNode;
}) {
  const reservedLeadingPx = botsSidebarCollapsed ? 0 : BOTS_SIDEBAR_WIDTH;
  const [preferredWidth, setPreferredWidth] = useState(readPreferredWidth);
  const [maxWidth, setMaxWidth] = useState(() => maximumWidth(reservedLeadingPx));
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; width: number; direction: number } | null>(null);
  const width = Math.max(MIN_WIDTH, Math.min(maxWidth, preferredWidth));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(preferredWidth));
    } catch {
      /* Storage may be disabled. */
    }
  }, [preferredWidth]);

  useEffect(() => {
    function syncMax() {
      setMaxWidth(maximumWidth(reservedLeadingPx));
    }
    syncMax();
    window.addEventListener("resize", syncMax);
    return () => window.removeEventListener("resize", syncMax);
  }, [reservedLeadingPx]);

  function stopDrag(event: PointerEvent<HTMLHRElement>) {
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function setWidthFromUser(next: number) {
    setPreferredWidth(Math.max(MIN_WIDTH, Math.min(maximumWidth(reservedLeadingPx), next)));
  }

  return (
    <aside
      data-testid="side-panel"
      data-panel={panel}
      style={{ "--panel-width": `${width}px` } as CSSProperties}
      className={`absolute inset-y-0 end-0 z-20 flex min-h-0 shrink-0 flex-col overflow-hidden bg-background md:relative ${dragging ? "" : "transition-[width] duration-150 ease-out"} ${open ? "w-full max-w-[384px] border-s border-sidebar-border md:w-(--panel-width) md:max-w-none" : "pointer-events-none w-0"}`}
    >
      {open ? (
        <hr
          tabIndex={0}
          aria-label={t`Resize panel`}
          aria-orientation="vertical"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={maxWidth}
          aria-valuenow={Math.round(width)}
          className="absolute inset-y-0 start-0 z-30 m-0 hidden h-full w-2 touch-none cursor-col-resize border-0 bg-transparent hover:bg-border focus-visible:bg-border focus-visible:outline-none md:block"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              x: event.clientX,
              width,
              direction: document.documentElement.dir === "rtl" ? -1 : 1,
            };
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (drag.current)
              setWidthFromUser(
                drag.current.width + (drag.current.x - event.clientX) * drag.current.direction,
              );
          }}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onLostPointerCapture={() => {
            drag.current = null;
            setDragging(false);
          }}
          onKeyDown={(event) => {
            const direction = document.documentElement.dir === "rtl" ? -1 : 1;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setWidthFromUser(width + (event.key === "ArrowLeft" ? 32 : -32) * direction);
            } else if (event.key === "Home") {
              event.preventDefault();
              setWidthFromUser(MIN_WIDTH);
            } else if (event.key === "End") {
              event.preventDefault();
              setWidthFromUser(maximumWidth(reservedLeadingPx));
            }
          }}
        />
      ) : null}
      {children}
    </aside>
  );
}
