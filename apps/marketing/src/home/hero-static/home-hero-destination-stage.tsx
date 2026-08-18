"use client";

import { useCallback, useEffect, useId, useState, type KeyboardEvent } from "react";

const SLIDE_INTERVAL_MS = 7000;
const CROSSFADE_MS = 800;

export type HomeHeroDestinationStoryView = Readonly<{
  readonly slug: string;
  readonly src: string;
  readonly name: string;
  readonly elevation: string;
  readonly caption: string;
}>;

export type HomeHeroDestinationStageProps = Readonly<{
  readonly stories: readonly HomeHeroDestinationStoryView[];
  readonly fallbackSrc: string;
  readonly groupLabel: string;
}>;

export function HomeHeroDestinationStage({
  stories,
  fallbackSrc,
  groupLabel,
}: HomeHeroDestinationStageProps) {
  const liveId = useId();
  const hasStories = stories.length > 0;
  const slides = hasStories
    ? stories
    : [
        {
          slug: "hero",
          src: fallbackSrc,
          name: "",
          elevation: "",
          caption: "",
        },
      ];
  const [activeIndex, setActiveIndex] = useState(0);
  const [motionReduced, setMotionReduced] = useState(false);
  const [autoplayStopped, setAutoplayStopped] = useState(false);
  const total = slides.length;
  const canAutoplay = !motionReduced && total > 1 && !autoplayStopped;
  const active = slides[Math.min(activeIndex, total - 1)] ?? slides[0];

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
    if (!canAutoplay) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % total);
    }, SLIDE_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [canAutoplay, total]);

  const selectIndex = useCallback((index: number) => {
    setAutoplayStopped(true);
    setActiveIndex(index);
  }, []);

  const onRadiogroupKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!hasStories || stories.length === 0) {
        return;
      }

      const last = stories.length - 1;
      let next = activeIndex;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = activeIndex === last ? 0 : activeIndex + 1;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = activeIndex === 0 ? last : activeIndex - 1;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = last;
      } else {
        return;
      }

      event.preventDefault();
      selectIndex(next);
      const radios = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      radios[next]?.focus();
    },
    [activeIndex, hasStories, selectIndex, stories.length]
  );

  return (
    <>
      <div data-marketing-home-hero-media aria-hidden="true">
        <div data-marketing-home-hero-carousel>
          {slides.map((slide, index) => (
            <img
              key={slide.slug}
              src={slide.src}
              alt=""
              data-marketing-home-hero-background
              data-marketing-home-hero-slide
              data-active={index === activeIndex ? "true" : "false"}
              data-hero-story={slide.slug}
              fetchPriority={index === 0 ? "high" : "low"}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              style={{
                transitionDuration: motionReduced ? "0ms" : `${CROSSFADE_MS}ms`,
              }}
            />
          ))}
        </div>
        <div
          data-marketing-home-hero-overlay-scrim
          data-hero-story={active?.slug}
        />
      </div>

      {hasStories ? (
        <div
          data-marketing-home-hero-selector
          role="radiogroup"
          aria-label={groupLabel}
          onKeyDown={onRadiogroupKeyDown}
        >
          {stories.map((story, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={story.slug}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={story.caption}
                tabIndex={selected ? 0 : -1}
                data-marketing-home-hero-destination={story.slug}
                data-selected={selected ? "true" : "false"}
                onClick={() => selectIndex(index)}
              >
                <img src={story.src} alt="" width={72} height={48} decoding="async" />
                <span data-marketing-home-hero-destination-label>
                  <span data-marketing-home-hero-destination-name>{story.name}</span>
                  {story.elevation ? (
                    <span data-marketing-home-hero-destination-elevation>
                      {story.elevation}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <p id={liveId} data-marketing-home-hero-live aria-live="polite">
        {hasStories && active ? active.caption : ""}
      </p>
    </>
  );
}
