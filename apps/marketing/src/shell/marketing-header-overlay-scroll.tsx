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

    const hero = document.querySelector<HTMLElement>("[data-marketing-home-hero-walk]");

    function sync() {
      const limit = hero
        ? Math.max(8, hero.offsetHeight - header.offsetHeight)
        : header.offsetHeight;
      header.toggleAttribute("data-marketing-header-scrolled", window.scrollY >= limit);
    }

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      header.removeAttribute("data-marketing-header-scrolled");
    };
  }, []);

  return null;
}
