"use client";

import { useEffect, useState } from "react";

export type HomeHeroCarouselMediaProps = Readonly<{
  readonly slides: readonly string[];
}>;

const SLIDE_INTERVAL_MS = 7000;

export function HomeHeroCarouselMedia({ slides }: HomeHeroCarouselMediaProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [motionReduced, setMotionReduced] = useState(false);

  useEffect(() => {
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      setMotionReduced(motionMedia.matches);
      if (motionMedia.matches) {
        setActiveIndex(0);
      }
    };
    syncMotion();
    motionMedia.addEventListener("change", syncMotion);
    return () => {
      motionMedia.removeEventListener("change", syncMotion);
    };
  }, []);

  useEffect(() => {
    if (motionReduced || slides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [motionReduced, slides.length]);

  return (
    <div data-marketing-home-hero-carousel aria-hidden="true">
      {slides.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          data-marketing-home-hero-background
          data-marketing-home-hero-slide
          data-active={index === activeIndex ? "true" : "false"}
          fetchPriority={index === 0 ? "high" : "low"}
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </div>
  );
}
