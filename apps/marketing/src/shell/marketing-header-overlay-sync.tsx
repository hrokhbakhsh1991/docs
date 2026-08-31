"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

import { isMarketingHomePath } from "./resolve-marketing-header-overlay";

/**
 * Root layout reads overlay mode from middleware request headers (SSR only).
 * Client navigations reuse the shell DOM, so sync overlay attribute from pathname.
 */
export function MarketingHeaderOverlaySync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>("[data-marketing-shell]");
    const header = document.querySelector<HTMLElement>("header[data-marketing-header]");
    if (!shell || !header) {
      return;
    }

    const useOverlay =
      shell.hasAttribute("data-marketing-full-landing") && isMarketingHomePath(pathname);

    if (useOverlay) {
      header.setAttribute("data-marketing-header-overlay", "");
      return;
    }

    header.removeAttribute("data-marketing-header-overlay");
    header.removeAttribute("data-marketing-header-scrolled");
  }, [pathname]);

  return null;
}
