"use client";

import { AlertTriangle, Droplet, PlayCircle, Thermometer } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { type DamavandAscentWaypointId } from "./home-damavand-ascent-waypoint-ids";
import { HomeDamavandAscentMountain } from "./home-damavand-ascent-mountain";

const ALTITUDE_MIN_M = 2200;
const ALTITUDE_MAX_M = 5610;
const DESKTOP_SCROLL_DISTANCE_PX = 2000;
const MOBILE_SCROLL_DISTANCE_PX = 1400;
const MOBILE_MAX_WIDTH_PX = 1023;

export type DamavandAscentWaypointCopy = Readonly<{
  readonly id: DamavandAscentWaypointId;
  readonly title: string;
  readonly alt: string;
  readonly description: string;
  readonly warning: string;
}>;

export type HomeDamavandAscentStageCopy = Readonly<{
  readonly eyebrow: string;
  readonly titleLine1: string;
  readonly titleLine2: string;
  readonly lead: string;
  readonly hudTitle: string;
  readonly hudLive: string;
  readonly altitudeLabel: string;
  readonly altitudeUnit: string;
  readonly oxygenLabel: string;
  readonly temperatureLabel: string;
  readonly waypoints: readonly DamavandAscentWaypointCopy[];
}>;

export type HomeDamavandAscentStageProps = Readonly<{
  readonly copy: HomeDamavandAscentStageCopy;
}>;

function formatMetric(value: number, locale: string): string {
  return value.toLocaleString(locale === "fa" ? "fa-IR" : "en-US");
}

function resolveScrollDistancePx(): number {
  if (typeof window === "undefined") {
    return DESKTOP_SCROLL_DISTANCE_PX;
  }
  return window.innerWidth <= MOBILE_MAX_WIDTH_PX
    ? MOBILE_SCROLL_DISTANCE_PX
    : DESKTOP_SCROLL_DISTANCE_PX;
}

function resolveActiveWaypoint(
  progress: number,
  waypoints: readonly DamavandAscentWaypointCopy[]
): DamavandAscentWaypointCopy {
  if (waypoints.length === 0) {
    return {
      id: "base",
      title: "",
      alt: "",
      description: "",
      warning: "",
    };
  }

  if (progress >= 0.85) {
    return waypoints[2] ?? waypoints[waypoints.length - 1]!;
  }

  if (progress >= 0.45) {
    return waypoints[1] ?? waypoints[0]!;
  }

  return waypoints[0]!;
}

export function HomeDamavandAscentStage({ copy }: HomeDamavandAscentStageProps) {
  const locale = useLocale();
  const outerRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [progress, setProgress] = useState(0);
  const [pathLength, setPathLength] = useState(0);
  const [motionReduced, setMotionReduced] = useState(false);
  const [scrollDistancePx, setScrollDistancePx] = useState(DESKTOP_SCROLL_DISTANCE_PX);

  const measurePath = () => {
    const path = pathRef.current;
    if (path == null) {
      return;
    }
    setPathLength(path.getTotalLength());
  };

  useEffect(() => {
    measurePath();
    window.addEventListener("resize", measurePath);
    return () => window.removeEventListener("resize", measurePath);
  }, []);

  useEffect(() => {
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const syncProgress = () => {
      const section = outerRef.current;
      if (section == null) {
        return;
      }

      if (motionMedia.matches) {
        setProgress(1);
        return;
      }

      const distance = resolveScrollDistancePx();
      setScrollDistancePx(distance);

      const rect = section.getBoundingClientRect();
      const scrolled = Math.max(0, -rect.top);
      setProgress(Math.min(1, scrolled / distance));
    };

    const scheduleProgressSync = () => {
      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncProgress();
      });
    };

    const onMotionChange = () => {
      setMotionReduced(motionMedia.matches);
      scheduleProgressSync();
    };

    const onResize = () => {
      measurePath();
      scheduleProgressSync();
    };

    onMotionChange();
    motionMedia.addEventListener("change", onMotionChange);
    window.addEventListener("scroll", scheduleProgressSync, { passive: true });
    window.addEventListener("resize", onResize);

    const resizeObserver = new ResizeObserver(() => {
      measurePath();
      scheduleProgressSync();
    });
    if (outerRef.current != null) {
      resizeObserver.observe(outerRef.current);
    }

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      motionMedia.removeEventListener("change", onMotionChange);
      window.removeEventListener("scroll", scheduleProgressSync);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
    };
  }, []);

  const altitude = Math.round(ALTITUDE_MIN_M + progress * (ALTITUDE_MAX_M - ALTITUDE_MIN_M));
  const oxygen = Math.round(100 - progress * 55);
  const temperature = Math.round(18 - progress * 33);
  const temperaturePositive = temperature > 0;

  const activeWaypoint = useMemo(
    () => resolveActiveWaypoint(progress, copy.waypoints),
    [copy.waypoints, progress]
  );

  const shelterActive = progress >= 0.45;
  const summitActive = progress >= 0.85;
  const showWaypointCard = progress > 0.05 && progress < 0.99;

  const sectionStyle = {
    "--mkt-ascent-progress": String(progress),
    "--mkt-ascent-scroll-distance": motionReduced ? "0px" : `${scrollDistancePx}px`,
  } as CSSProperties;

  return (
    <section
      ref={outerRef}
      data-marketing-home-ascent
      id="ascent"
      data-marketing-home-ascent-motion-reduced={motionReduced ? "true" : undefined}
      style={sectionStyle}
    >
      <div data-marketing-home-ascent-pin>
        <div data-marketing-home-ascent-shell>
          <div data-marketing-home-ascent-layout>
            <div data-marketing-home-ascent-sidebar>
              <div data-marketing-home-ascent-intro>
                <p data-marketing-home-ascent-eyebrow>
                  <PlayCircle aria-hidden="true" />
                  <span>{copy.eyebrow}</span>
                </p>
                <h2 data-marketing-home-ascent-title>
                  {copy.titleLine1}
                  <br />
                  {copy.titleLine2}
                </h2>
                <p data-marketing-home-ascent-lead>{copy.lead}</p>
              </div>

              <aside data-marketing-home-ascent-hud aria-live="polite">
                <div data-marketing-home-ascent-hud-header>
                  <span>{copy.hudTitle}</span>
                  <span data-marketing-home-ascent-hud-badge>{copy.hudLive}</span>
                </div>

                <div data-marketing-home-ascent-hud-altitude>
                  <div data-marketing-home-ascent-hud-altitude-row>
                    <span>{copy.altitudeLabel}</span>
                    <div>
                      <span data-marketing-home-ascent-hud-altitude-value>
                        {formatMetric(altitude, locale)}
                      </span>
                      <span data-marketing-home-ascent-hud-altitude-unit>{copy.altitudeUnit}</span>
                    </div>
                  </div>
                  <div data-marketing-home-ascent-hud-progress-track>
                    <div
                      data-marketing-home-ascent-hud-progress-fill
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>

                <div data-marketing-home-ascent-hud-metrics>
                  <div data-marketing-home-ascent-hud-metric>
                    <span>{copy.oxygenLabel}</span>
                    <div>
                      <Droplet aria-hidden="true" data-marketing-home-ascent-icon-oxygen />
                      <span>
                        {formatMetric(oxygen, locale)}
                        {locale === "fa" ? "٪" : "%"}
                      </span>
                    </div>
                  </div>
                  <div data-marketing-home-ascent-hud-metric>
                    <span>{copy.temperatureLabel}</span>
                    <div>
                      <Thermometer
                        aria-hidden="true"
                        data-marketing-home-ascent-icon-temp
                        data-marketing-home-ascent-temp-positive={
                          temperaturePositive ? "true" : "false"
                        }
                      />
                      <span data-marketing-home-ascent-temp-value>
                        {temperaturePositive ? `+${temperature}` : temperature}°C
                      </span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div data-marketing-home-ascent-visual>
              <div
                data-marketing-home-ascent-waypoint-card
                data-marketing-home-ascent-waypoint-card-visible={
                  showWaypointCard ? "true" : "false"
                }
                aria-hidden={showWaypointCard ? undefined : "true"}
              >
                <div data-marketing-home-ascent-waypoint-card-header>
                  <h3>{activeWaypoint.title}</h3>
                  <span>{activeWaypoint.alt}</span>
                </div>
                <p>{activeWaypoint.description}</p>
                <div data-marketing-home-ascent-waypoint-warning>
                  <AlertTriangle aria-hidden="true" />
                  <span>{activeWaypoint.warning}</span>
                </div>
              </div>

              <div data-marketing-home-ascent-mountain-frame>
                <HomeDamavandAscentMountain
                  pathRef={pathRef}
                  pathLength={pathLength}
                  progress={progress}
                  shelterActive={shelterActive}
                  summitActive={summitActive}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
