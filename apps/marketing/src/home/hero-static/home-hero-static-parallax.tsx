"use client";

import { useCallback, useEffect, useRef, type PointerEvent, type ReactNode } from "react";

const MOBILE_MAX_WIDTH_PX = 639;
const PARALLAX_MAX_PX = 10;
const SCROLL_PARALLAX_MAX_PX = 24;

type HomeHeroStaticParallaxProps = Readonly<{
  readonly children: ReactNode;
}>;

export function HomeHeroStaticParallax({ children }: HomeHeroStaticParallaxProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileMedia = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);

    const section = rootRef.current?.closest("section[data-marketing-home-hero-cinematic]");
    let scrollRaf = 0;

    const syncScrollShift = () => {
      scrollRaf = 0;
      const root = rootRef.current;
      if (root == null || root.dataset.marketingHomeHeroParallaxDisabled === "true") {
        root?.style.setProperty("--mkt-hero-scroll-shift", "0px");
        root?.style.setProperty("--mkt-hero-content-opacity", "1");
        return;
      }
      const heroSection =
        section ?? root.closest("section[data-marketing-home-hero-cinematic]");
      if (heroSection == null) {
        return;
      }
      const rect = heroSection.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
      root.style.setProperty(
        "--mkt-hero-scroll-shift",
        `${progress * SCROLL_PARALLAX_MAX_PX}px`
      );
      root.style.setProperty(
        "--mkt-hero-content-opacity",
        String(Math.max(0.78, 1 - progress * 0.22))
      );
    };

    const sync = () => {
      const root = rootRef.current;
      if (root == null) {
        return;
      }
      if (motionMedia.matches || mobileMedia.matches) {
        root.dataset.marketingHomeHeroParallaxDisabled = "true";
        root.style.setProperty("--mkt-hero-parallax-x", "0px");
        root.style.setProperty("--mkt-hero-parallax-y", "0px");
        root.style.setProperty("--mkt-hero-scroll-shift", "0px");
        root.style.setProperty("--mkt-hero-content-opacity", "1");
      } else {
        delete root.dataset.marketingHomeHeroParallaxDisabled;
      }
      syncScrollShift();
    };

    sync();
    motionMedia.addEventListener("change", sync);
    mobileMedia.addEventListener("change", sync);

    const onScroll = () => {
      if (scrollRaf !== 0) {
        return;
      }
      scrollRaf = window.requestAnimationFrame(syncScrollShift);
    };

    syncScrollShift();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      motionMedia.removeEventListener("change", sync);
      mobileMedia.removeEventListener("change", sync);
      window.removeEventListener("scroll", onScroll);
      if (scrollRaf !== 0) {
        window.cancelAnimationFrame(scrollRaf);
      }
    };
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (root == null || root.dataset.marketingHomeHeroParallaxDisabled === "true") {
      return;
    }
    const rect = root.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    root.style.setProperty("--mkt-hero-parallax-x", `${x * PARALLAX_MAX_PX}px`);
    root.style.setProperty("--mkt-hero-parallax-y", `${y * PARALLAX_MAX_PX}px`);
  }, []);

  const handlePointerLeave = useCallback(() => {
    const root = rootRef.current;
    if (root == null || root.dataset.marketingHomeHeroParallaxDisabled === "true") {
      return;
    }
    root.style.setProperty("--mkt-hero-parallax-x", "0px");
    root.style.setProperty("--mkt-hero-parallax-y", "0px");
  }, []);

  return (
    <div
      ref={rootRef}
      data-marketing-home-hero-parallax-root
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </div>
  );
}
