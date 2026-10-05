import { useLayoutEffect, useState } from "react";

export type CalendarPopoverPlacement = "top" | "bottom";
/** Horizontal anchor of the popover relative to its trigger, independent of vertical placement. */
export type CalendarPopoverAlign = "start" | "end";

const DEFAULT_ESTIMATED_HEIGHT_PX = 420;
const DEFAULT_ESTIMATED_WIDTH_PX = 320;
const GAP_PX = 8;
const VIEWPORT_PADDING_PX = 16;

function measurePlacement(
  trigger: HTMLElement,
  popover: HTMLElement | null,
  collisionSelectors: readonly string[]
): CalendarPopoverPlacement {
  const triggerRect = trigger.getBoundingClientRect();
  const popoverHeight =
    popover !== null && popover.getBoundingClientRect().height > 0
      ? popover.getBoundingClientRect().height
      : DEFAULT_ESTIMATED_HEIGHT_PX;

  let lowerBound = window.innerHeight - VIEWPORT_PADDING_PX;
  for (const selector of collisionSelectors) {
    const node = document.querySelector(selector);
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (rect.height <= 0) {
      continue;
    }
    if (rect.top < window.innerHeight) {
      lowerBound = Math.min(lowerBound, rect.top - GAP_PX);
    }
  }

  const spaceBelow = lowerBound - triggerRect.bottom - GAP_PX;
  const spaceAbove = triggerRect.top - GAP_PX - VIEWPORT_PADDING_PX;
  return spaceBelow < popoverHeight && spaceAbove > spaceBelow ? "top" : "bottom";
}

/**
 * Decides whether the popover should anchor to the trigger's inline-start edge
 * (default) or flip to the inline-end edge to avoid overflowing the viewport.
 * Uses physical left/right math (not inline-start/end) because
 * getBoundingClientRect() is always physical, regardless of text direction.
 */
function measureAlign(trigger: HTMLElement, popover: HTMLElement | null): CalendarPopoverAlign {
  const triggerRect = trigger.getBoundingClientRect();
  const popoverWidth =
    popover !== null && popover.getBoundingClientRect().width > 0
      ? popover.getBoundingClientRect().width
      : DEFAULT_ESTIMATED_WIDTH_PX;
  const isRtl = getComputedStyle(trigger).direction === "rtl";

  if (isRtl) {
    // inline-start = right edge; popover would grow to the left (toward smaller x).
    const spaceToStart = triggerRect.right - VIEWPORT_PADDING_PX;
    if (spaceToStart >= popoverWidth) {
      return "start";
    }
    const spaceToEnd = window.innerWidth - VIEWPORT_PADDING_PX - triggerRect.left;
    return spaceToEnd > spaceToStart ? "end" : "start";
  }

  // inline-start = left edge; popover would grow to the right.
  const spaceToStart = window.innerWidth - VIEWPORT_PADDING_PX - triggerRect.left;
  if (spaceToStart >= popoverWidth) {
    return "start";
  }
  const spaceToEnd = triggerRect.right - VIEWPORT_PADDING_PX;
  return spaceToEnd > spaceToStart ? "end" : "start";
}

export function useCalendarPopoverPlacement(
  open: boolean,
  rootRef: React.RefObject<HTMLElement | null>,
  collisionSelectors: readonly string[] = []
): CalendarPopoverPlacement {
  const [placement, setPlacement] = useState<CalendarPopoverPlacement>("bottom");

  useLayoutEffect(() => {
    if (!open) {
      setPlacement("bottom");
      return;
    }

    const root = rootRef.current;
    if (root == null) {
      return;
    }

    const trigger = root.querySelector("[data-operator-date-picker]");
    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    const update = () => {
      const popover = root.querySelector("[data-operator-wizard-calendar-popover]");
      setPlacement(
        measurePlacement(
          trigger,
          popover instanceof HTMLElement ? popover : null,
          collisionSelectors
        )
      );
    };

    update();
    const popover = root.querySelector("[data-operator-wizard-calendar-popover]");
    const resizeObserver =
      popover instanceof HTMLElement ? new ResizeObserver(update) : null;
    resizeObserver?.observe(popover as HTMLElement);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [collisionSelectors, open, rootRef]);

  return placement;
}

/** Horizontal counterpart of {@link useCalendarPopoverPlacement}; flips to the trigger's inline-end edge when the popover would otherwise overflow the viewport. */
export function useCalendarPopoverAlign(
  open: boolean,
  rootRef: React.RefObject<HTMLElement | null>
): CalendarPopoverAlign {
  const [align, setAlign] = useState<CalendarPopoverAlign>("start");

  useLayoutEffect(() => {
    if (!open) {
      setAlign("start");
      return;
    }

    const root = rootRef.current;
    if (root == null) {
      return;
    }

    const trigger = root.querySelector("[data-operator-date-picker]");
    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    const update = () => {
      const popover = root.querySelector("[data-operator-wizard-calendar-popover]");
      setAlign(measureAlign(trigger, popover instanceof HTMLElement ? popover : null));
    };

    update();
    const popover = root.querySelector("[data-operator-wizard-calendar-popover]");
    const resizeObserver =
      popover instanceof HTMLElement ? new ResizeObserver(update) : null;
    resizeObserver?.observe(popover as HTMLElement);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, rootRef]);

  return align;
}
