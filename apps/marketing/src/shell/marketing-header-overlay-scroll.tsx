"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { isMarketingHomePath } from "./resolve-marketing-header-overlay";

/**
 * Home overlay Header: mist running-head after Walk Hero exits.
 * The shell persists across client navigation, so this island also removes a
 * home-only overlay that was rendered on the previous route.
 */
export function MarketingHeaderOverlayScroll() {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header[data-marketing-header]");
    if (!header) {
      return;
    }

    const overlayHeader = header;
    if (!isMarketingHomePath(pathname)) {
      overlayHeader.removeAttribute("data-marketing-header-overlay");
      overlayHeader.removeAttribute("data-marketing-header-scrolled");
      return;
    }

    overlayHeader.setAttribute("data-marketing-header-overlay", "");
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
  }, [pathname]);

  return null;
}
