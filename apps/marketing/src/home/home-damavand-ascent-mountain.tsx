import type { RefObject } from "react";

export type HomeDamavandAscentMountainProps = Readonly<{
  readonly pathRef: RefObject<SVGPathElement | null>;
  readonly pathLength: number;
  readonly progress: number;
  readonly shelterActive: boolean;
  readonly summitActive: boolean;
}>;

const CLIMB_ROUTE_D =
  "M 220,770 C 300,720 350,680 340,610 C 330,540 400,500 440,450 C 480,400 420,340 460,290 C 490,250 495,200 500,165";

export function HomeDamavandAscentMountain({
  pathRef,
  pathLength,
  progress,
  shelterActive,
  summitActive,
}: HomeDamavandAscentMountainProps) {
  const dashOffset = pathLength > 0 ? pathLength - progress * pathLength : pathLength;

  return (
    <div data-marketing-home-ascent-mountain>
      <svg
        viewBox="0 0 1000 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        data-marketing-home-ascent-mountain-svg
      >
        <defs>
          <linearGradient id="mkt-ascent-sky-grad" x1="500" y1="350" x2="500" y2="650">
            <stop offset="0%" stopColor="var(--mkt-ascent-route-color)" />
            <stop offset="100%" stopColor="var(--mkt-ascent-bg)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mkt-ascent-snow-grad" x1="500" y1="150" x2="500" y2="280">
            <stop offset="0%" stopColor="var(--mkt-ascent-snow-highlight)" />
            <stop offset="100%" stopColor="var(--mkt-ascent-snow-shadow)" />
          </linearGradient>
          <filter id="mkt-ascent-neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse
          cx="500"
          cy="500"
          rx="300"
          ry="150"
          fill="url(#mkt-ascent-sky-grad)"
          opacity="0.1"
        />
        <path
          d="M-100,800 L250,550 L400,600 L600,450 L1100,800 Z"
          fill="var(--mkt-ascent-ridge-far)"
          opacity="0.6"
        />
        <path
          d="M100,800 L350,420 L500,500 L750,300 L1100,800 Z"
          fill="var(--mkt-ascent-ridge-mid)"
        />
        <path
          d="M 150,800 L 500,150 L 850,800 Z"
          fill="var(--mkt-ascent-ridge-near)"
          stroke="var(--mkt-ascent-ridge-stroke)"
          strokeWidth="2"
        />
        <path
          d="M 430,270 L 500,150 L 570,270 L 530,250 L 500,280 L 470,250 Z"
          fill="url(#mkt-ascent-snow-grad)"
          opacity="0.95"
        />
        <path
          d="M 410,310 L 440,260 L 470,300 L 450,320 Z"
          fill="url(#mkt-ascent-snow-grad)"
          opacity="0.7"
        />
        <path
          d="M 530,320 L 560,260 L 590,300 L 570,330 Z"
          fill="url(#mkt-ascent-snow-grad)"
          opacity="0.7"
        />

        <path
          ref={pathRef}
          d={CLIMB_ROUTE_D}
          fill="none"
          stroke="var(--mkt-ascent-route-color)"
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#mkt-ascent-neon-glow)"
          strokeDasharray={pathLength > 0 ? pathLength : undefined}
          strokeDashoffset={dashOffset}
          data-marketing-home-ascent-route
        />

        <g transform="translate(220, 770)">
          <circle
            r="12"
            fill="var(--mkt-ascent-route-color)"
            fillOpacity="0.2"
            className="mkt-ascent-pin-pulse"
          />
          <circle
            r="6"
            fill="var(--mkt-ascent-route-color)"
            stroke="var(--mkt-ascent-pin-stroke)"
            strokeWidth="1.5"
          />
        </g>

        <g transform="translate(440, 450)">
          {shelterActive ? (
            <circle
              r="12"
              fill="var(--mkt-ascent-route-color)"
              fillOpacity="0.2"
              className="mkt-ascent-pin-pulse"
            />
          ) : null}
          <circle
            r="6"
            fill={shelterActive ? "var(--mkt-ascent-route-color)" : "var(--mkt-ascent-pin-muted)"}
            stroke="var(--mkt-ascent-route-color)"
            strokeWidth="2"
          />
        </g>

        <g transform="translate(500, 165)">
          <polygon
            points="0,-12 10,6 -10,6"
            fill={summitActive ? "var(--mkt-ascent-route-color)" : "var(--mkt-ascent-summit-idle)"}
            className={summitActive ? "mkt-ascent-summit-active" : undefined}
          />
          {summitActive ? (
            <circle
              r="15"
              fill="var(--mkt-ascent-summit-idle)"
              fillOpacity="0.2"
              className="mkt-ascent-pin-pulse"
            />
          ) : null}
        </g>
      </svg>
    </div>
  );
}
