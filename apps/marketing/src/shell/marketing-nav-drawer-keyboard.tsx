"use client";

import { useEffect } from "react";

/**
 * Shared marketing a11y: native `<details>` does not close on Escape.
 * Correct for every MarketingShell consumer (Landing + catalog).
 */
export function MarketingNavDrawerKeyboard() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      const drawer = document.querySelector<HTMLDetailsElement>(
        "[data-marketing-nav-drawer][open]",
      );
      if (!drawer) {
        return;
      }
      event.preventDefault();
      drawer.open = false;
      drawer.querySelector<HTMLElement>("[data-marketing-nav-drawer-toggle]")?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
