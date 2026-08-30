import { useLayoutEffect, useState } from "react";

export type CalendarPopoverPlacement = "top" | "bottom";

const DEFAULT_ESTIMATED_HEIGHT_PX = 420;
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
