"use client";

import { ChevronLeft, ChevronRight, Mountain } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from "react";

import { DEFAULT_HERO_SPOTLIGHT_ID } from "./build-home-hero-spotlights";
import { HomeHeroMountainCanvas } from "./home-hero-mountain-canvas";
import type { HomeHeroSpotlight } from "./home-hero-spotlight-types";

type RotationNudge = -1 | 1;

const MOBILE_MAX_WIDTH_PX = 639;

export type HomeHeroMountainStageLabels = Readonly<{
  readonly rotateLabel: string;
  readonly rotatePrev: string;
  readonly rotateNext: string;
  readonly exploreTours: string;
}>;

export type HomeHeroMountainStageProps = Readonly<{
  readonly spotlights: readonly HomeHeroSpotlight[];
  readonly labels: HomeHeroMountainStageLabels;
}>;

function resolveInitialIndex(spotlights: readonly HomeHeroSpotlight[]): number {
  const defaultIndex = spotlights.findIndex((item) => item.id === DEFAULT_HERO_SPOTLIGHT_ID);
  return defaultIndex >= 0 ? defaultIndex : 0;
}

export function HomeHeroMountainStage({ spotlights, labels }: HomeHeroMountainStageProps) {
  const [activeIndex, setActiveIndex] = useState(() => resolveInitialIndex(spotlights));
  const [autoRotate, setAutoRotate] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [lowPower, setLowPower] = useState(false);
  const [nudgeToken, setNudgeToken] = useState(0);
  const [nudgeDirection, setNudgeDirection] = useState<RotationNudge>(1);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [webglLost, setWebglLost] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileMedia = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`);

    const sync = () => {
      const prefersReduced = motionMedia.matches;
      const isMobile = mobileMedia.matches;
      setReduceMotion(prefersReduced);
      setLowPower(isMobile);
      if (prefersReduced || isMobile) {
        setAutoRotate(false);
      }
    };

    sync();
    motionMedia.addEventListener("change", sync);
    mobileMedia.addEventListener("change", sync);
    return () => {
      motionMedia.removeEventListener("change", sync);
      mobileMedia.removeEventListener("change", sync);
    };
  }, []);

  const active = spotlights[activeIndex] ?? spotlights[0];

  const orbitStyle = useMemo(
    () =>
      ({
        ["--mkt-hero-orbit-index" as string]: String(activeIndex),
      }) satisfies CSSProperties,
    [activeIndex]
  );

  const handleScenePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (lowPower || reduceMotion) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    setParallax({ x, y });
  }, [lowPower, reduceMotion]);

  const handleScenePointerLeave = useCallback(() => {
    setParallax({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    setCanvasReady(false);
  }, [activeIndex]);

  if (active == null) {
    return null;
  }

  const nudgeRotation = (direction: RotationNudge) => {
    setAutoRotate(false);
    setNudgeDirection(direction);
    setNudgeToken((current) => current + 1);
  };

  const useStaticScene = reduceMotion || lowPower || webglLost;
  const showWebglCanvas = !reduceMotion && !lowPower && !webglLost;

  return (
    <div data-marketing-home-hero-stage style={orbitStyle}>
      <div
        data-marketing-home-hero-scene
        onPointerMove={handleScenePointerMove}
        onPointerLeave={handleScenePointerLeave}
      >
        <div data-marketing-home-hero-orbit-ring aria-hidden="true" />
        <div
          data-marketing-home-hero-canvas-shell
          data-marketing-home-hero-canvas-ready={canvasReady || useStaticScene ? true : undefined}
        >
          {showWebglCanvas ? (
            <>
              <div data-marketing-home-hero-scene-poster aria-hidden="true" />
              <HomeHeroMountainCanvas
                textureUrl={active.imagePath}
                autoRotate={autoRotate}
                nudgeToken={nudgeToken}
                nudgeDirection={nudgeDirection}
                parallaxX={parallax.x}
                parallaxY={parallax.y}
                onContextLost={() => setWebglLost(true)}
                onReady={() => setCanvasReady(true)}
              />
            </>
          ) : (
            <img
              src={active.imagePath}
              alt=""
              data-marketing-home-hero-scene-fallback
              loading="eager"
            />
          )}
        </div>
        <div data-marketing-home-hero-pedestal aria-hidden="true" />
      </div>

      <div data-marketing-home-hero-spotlight-copy>
        <p data-marketing-home-hero-spotlight-tagline>{active.tagline}</p>
        <p data-marketing-home-hero-spotlight-name aria-live="polite">
          {active.name}
        </p>
        <p data-marketing-home-hero-spotlight-description>{active.description}</p>
        <a href={active.toursHref} data-marketing-home-hero-spotlight-cta="">
          {labels.exploreTours}
        </a>
      </div>

      <aside data-marketing-home-hero-stats aria-label={active.name}>
        <dl>
          <div data-marketing-home-hero-stat>
            <Mountain aria-hidden="true" size={18} />
            <div>
              <dt>{active.elevationLabel}</dt>
              <dd>{active.elevationValue}</dd>
            </div>
          </div>
          <div data-marketing-home-hero-stat>
            <Mountain aria-hidden="true" size={18} />
            <div>
              <dt>{active.regionLabel}</dt>
              <dd>{active.regionValue}</dd>
            </div>
          </div>
        </dl>
      </aside>

      <div data-marketing-home-hero-picker="">
        {spotlights.map((spotlight, index) => (
          <button
            key={spotlight.id}
            type="button"
            data-marketing-home-hero-picker-item=""
            data-active={index === activeIndex ? true : undefined}
            aria-pressed={index === activeIndex}
            onClick={() => {
              setAutoRotate(false);
              setActiveIndex(index);
            }}
          >
            <img src={spotlight.imagePath} alt="" loading="lazy" />
            <span>{spotlight.name}</span>
          </button>
        ))}
      </div>

      <div data-marketing-home-hero-rotate-controls="">
        <button
          type="button"
          data-marketing-home-hero-rotate-btn=""
          aria-label={labels.rotatePrev}
          onClick={() => nudgeRotation(-1)}
        >
          <ChevronRight aria-hidden="true" size={18} />
        </button>
        <span data-marketing-home-hero-rotate-label="">{labels.rotateLabel}</span>
        <button
          type="button"
          data-marketing-home-hero-rotate-btn=""
          aria-label={labels.rotateNext}
          onClick={() => nudgeRotation(1)}
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  );
}
