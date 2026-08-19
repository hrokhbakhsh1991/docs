"use client";

import { useEffect } from "react";

/**
 * Home overlay Header: mist running-head after Walk Hero exits.
 * No-ops on catalog/detail (no overlay attribute).
 */
export function MarketingHeaderOverlayScroll() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(
      "header[data-marketing-header][data-marketing-header-overlay]",
    );
    if (!header) {
      return;
    }

    const overlayHeader = header;
    const hero = document.querySelector<HTMLElement>("[data-marketing-home-hero-walk]");

    function sync() {
      const limit = hero
        ? Math.max(8, hero.offsetHeight - overlayHeader.offsetHeight)
        : overlayHeader.offsetHeight;
      overlayHeader.toggleAttribute("data-marketing-header-scrolled", window.scrollY >= limit);
    }

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      overlayHeader.removeAttribute("data-marketing-header-scrolled");
    };
  }, []);

  return null;
}
