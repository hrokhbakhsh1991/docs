"use client";

import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import {
  resolveDenaliAnchoredPopoverPlacement,
  type DenaliAnchoredPopoverPlacement,
} from "../logic/denali-anchored-popover-logic";

export type DenaliAnchoredPopoverPortalProps = {
  readonly open: boolean;
  readonly triggerRef: RefObject<HTMLElement | null>;
  readonly panelRef?: RefObject<HTMLDivElement | null>;
  readonly children: ReactNode;
  readonly className?: string;
  readonly "data-testid"?: string;
};

function readPlacement(trigger: HTMLElement): DenaliAnchoredPopoverPlacement {
  return resolveDenaliAnchoredPopoverPlacement({
    triggerRect: trigger.getBoundingClientRect(),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
}

/** Renders a dropdown panel on `document.body` aligned to the trigger rect. */
export function DenaliAnchoredPopoverPortal({
  open,
  triggerRef,
  panelRef,
  children,
  className,
  "data-testid": dataTestId,
}: DenaliAnchoredPopoverPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [placement, setPlacement] = useState<DenaliAnchoredPopoverPlacement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const update = () => {
      const trigger = triggerRef.current;
      if (trigger == null) {
        return;
      }
      setPlacement(readPlacement(trigger));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, triggerRef]);

  if (!open || !mounted || placement == null) {
    return null;
  }

  const style: CSSProperties = {
    position: "fixed",
    top: placement.top,
    left: placement.left,
    width: placement.width,
    maxHeight: placement.maxHeight,
    zIndex: "var(--z-popover, 60)",
    overflow: "auto",
  };

  return createPortal(
    <div
      ref={panelRef}
      className={className}
      data-new-tour-wizard
      data-operator-wizard-anchored-popover
      data-testid={dataTestId}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
}
