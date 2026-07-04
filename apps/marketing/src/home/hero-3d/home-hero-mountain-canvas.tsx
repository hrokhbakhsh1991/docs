"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { DirectionalLight, Group } from "three";
import { Color, DoubleSide, Fog, LatheGeometry, MathUtils, NoToneMapping, SRGBColorSpace, Vector2 } from "three";

/** Broad stratovolcano silhouette — radius (x) vs height (y) for LatheGeometry. */
const ROCK_PROFILE: readonly Vector2[] = [
  new Vector2(0, 0),
  new Vector2(2.35, 0),
  new Vector2(2.28, 0.22),
  new Vector2(2.05, 0.55),
  new Vector2(1.82, 0.95),
  new Vector2(1.62, 1.35),
  new Vector2(1.44, 1.78),
  new Vector2(1.28, 2.18),
  new Vector2(1.12, 2.58),
  new Vector2(0.98, 2.92),
  new Vector2(0, 2.92),
];

const SNOW_PROFILE: readonly Vector2[] = [
  new Vector2(0, 2.86),
  new Vector2(0.96, 2.9),
  new Vector2(0.88, 3.08),
  new Vector2(0.74, 3.28),
  new Vector2(0.58, 3.48),
  new Vector2(0.4, 3.62),
  new Vector2(0.22, 3.72),
  new Vector2(0, 3.78),
];

type RotationNudge = -1 | 1;

type HomeHeroMountainCanvasProps = Readonly<{
  readonly textureUrl: string;
  readonly autoRotate: boolean;
  readonly nudgeToken: number;
  readonly nudgeDirection: RotationNudge;
  readonly parallaxX: number;
  readonly parallaxY: number;
  readonly onContextLost?: () => void;
  readonly onReady?: () => void;
}>;

const IDLE_ORBIT_RADIANS_PER_SEC = (2 * Math.PI) / 90;
const NUDGE_RADIANS = 0.26;
const INTRO_DURATION_SEC = 10;

function createLathe(profile: readonly Vector2[], segments: number): LatheGeometry {
  return new LatheGeometry([...profile], segments, 0, Math.PI * 2);
}

function CanvasResizeSync() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const sync = () => {
      invalidate();
    };
    sync();
    window.addEventListener("resize", sync);
    const frame = window.requestAnimationFrame(sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", sync);
    };
  }, [invalidate]);

  return null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function SkyBackdrop() {
  return (
    <group>
      <mesh position={[0, 2.4, -9.5]}>
        <planeGeometry args={[24, 16]} />
        <meshBasicMaterial color="#243048" fog={false} />
      </mesh>
      <mesh position={[0.4, 4.6, -8.2]}>
        <planeGeometry args={[18, 8]} />
        <meshBasicMaterial color="#6a5038" transparent opacity={0.72} fog={false} />
      </mesh>
      <mesh position={[2.2, 5.1, -7.4]}>
        <circleGeometry args={[1.05, 32]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.58} fog={false} />
      </mesh>
    </group>
  );
}
function CloudDeck() {
  const materials = useRef<Array<{ opacity: number } | null>>([]);

  useFrame(({ clock }) => {
    const introEase = easeInOutCubic(Math.min(1, clock.getElapsedTime() / 8));
    const opacity = Math.max(0.04, 0.42 * (1 - introEase));
    materials.current.forEach((material, index) => {
      if (material != null) {
        material.opacity = opacity * (0.55 + index * 0.12);
      }
    });
  });

  const positions: readonly [number, number, number][] = [
    [-3.4, 5.2, -9.5],
    [3.8, 4.8, -10.2],
    [0.2, 5.4, -11],
  ];

  return (
    <group>
      {positions.map((position, index) => (
        <mesh key={index} position={position} rotation={[-Math.PI / 2.5, 0, index * 0.35]}>
          <planeGeometry args={[9, 3.2, 1, 1]} />
          <meshBasicMaterial
            ref={(instance) => {
              materials.current[index] = instance;
            }}
            color="#c8d4e0"
            transparent
            opacity={0.7}
            depthWrite={false}
            fog
          />
        </mesh>
      ))}
    </group>
  );
}

function SulfurPlume() {
  const plumeRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (plumeRef.current == null) {
      return;
    }
    const t = clock.getElapsedTime();
    const intensity = Math.min(1, t / 6 + 0.35);
    plumeRef.current.position.y = 3.52 + Math.sin(t * 0.35) * 0.035;
    plumeRef.current.rotation.y = t * 0.08;
    plumeRef.current.scale.setScalar(0.85 + intensity * 0.25);
  });

  return (
    <group ref={plumeRef} position={[0.05, 3.52, 0.04]}>
      <mesh>
        <coneGeometry args={[0.12, 0.55, 12, 1, true]} />
        <meshBasicMaterial color="#e8e0d0" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <coneGeometry args={[0.08, 0.35, 10, 1, true]} />
        <meshBasicMaterial color="#fef3c7" transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  );
}

function DamavandMountain({ textureUrl }: { readonly textureUrl: string }) {
  const rockGeometry = useMemo(() => createLathe(ROCK_PROFILE, 96), []);
  const snowGeometry = useMemo(() => createLathe(SNOW_PROFILE, 72), []);

  const rockColor =
    textureUrl.includes("alborz")
      ? "#4e574a"
      : textureUrl.includes("zardkooh")
        ? "#544c44"
        : "#5c5548";

  return (
    <group rotation={[0, 0.15, 0]} scale={[1.55, 1.55, 1.55]}>
      <mesh geometry={rockGeometry}>
        <meshBasicMaterial color={rockColor} fog={false} side={DoubleSide} />
      </mesh>

      <mesh geometry={snowGeometry}>
        <meshBasicMaterial color="#eef4fa" fog={false} side={DoubleSide} />
      </mesh>

      <mesh position={[0, 3.62, 0]}>
        <cylinderGeometry args={[0.34, 0.46, 0.18, 32, 1, true]} />
        <meshBasicMaterial color="#2a3034" side={DoubleSide} fog={false} />
      </mesh>

      <SulfurPlume />
    </group>
  );
}

function CinematicRig({
  textureUrl,
  autoRotate,
  nudgeToken,
  nudgeDirection,
  parallaxX,
  parallaxY,
  onReady,
}: HomeHeroMountainCanvasProps) {
  const mountainRef = useRef<Group>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const pendingNudge = useRef(0);
  const readySent = useRef(false);
  const { camera, scene } = useThree();

  const baseCamera = useMemo(() => ({ x: 0.35, y: 3.05, z: 12.5 }), []);
  const skyColor = useMemo(() => new Color("#1a2840"), []);
  const fogStartColor = useMemo(() => new Color("#5a6a82"), []);
  const fogEndColor = useMemo(() => new Color("#8aa4c8"), []);
  const sunStartColor = useMemo(() => new Color("#94a3b8"), []);
  const sunEndColor = useMemo(() => new Color("#fef3c7"), []);

  useEffect(() => {
    scene.background = skyColor;
    scene.fog = new Fog("#7a8ea8", 10, 36);
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, skyColor]);

  useEffect(() => {
    if (nudgeToken <= 0) {
      return;
    }
    pendingNudge.current += nudgeDirection * NUDGE_RADIANS;
  }, [nudgeDirection, nudgeToken]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const introEase = easeInOutCubic(Math.min(1, elapsed / INTRO_DURATION_SEC));

    if (scene.fog instanceof Fog) {
      scene.fog.near = MathUtils.lerp(7.5, 9, introEase);
      scene.fog.far = MathUtils.lerp(24, 32, introEase);
      scene.fog.color.lerpColors(fogStartColor, fogEndColor, introEase);
    }

    if (sunRef.current != null) {
      sunRef.current.intensity = MathUtils.lerp(0.85, 1.45, introEase);
      sunRef.current.color.lerpColors(sunStartColor, sunEndColor, introEase);
    }

    const breathe = Math.sin(elapsed * 0.5) * 0.022;
    const breatheZ = Math.cos(elapsed * 0.4) * 0.014;
    camera.position.set(baseCamera.x, baseCamera.y + breathe, baseCamera.z + breatheZ);
    if ("fov" in camera) {
      const perspective = camera as { fov: number; updateProjectionMatrix: () => void };
      perspective.fov = MathUtils.lerp(32, 28, introEase);
      perspective.updateProjectionMatrix();
    }
    camera.lookAt(0, 2.75, 0);

    if (mountainRef.current != null) {
      if (autoRotate) {
        mountainRef.current.rotation.y += delta * IDLE_ORBIT_RADIANS_PER_SEC;
      }
      if (Math.abs(pendingNudge.current) > 0.0001) {
        const step =
          Math.sign(pendingNudge.current) *
          Math.min(Math.abs(pendingNudge.current), delta * 0.35);
        mountainRef.current.rotation.y += step;
        pendingNudge.current -= step;
      }
      mountainRef.current.rotation.y += -parallaxX * 0.015 * delta * 60;
      mountainRef.current.rotation.x = MathUtils.lerp(
        mountainRef.current.rotation.x,
        parallaxY * 0.008,
        0.06
      );
    }

    if (!readySent.current && elapsed > 0.35) {
      readySent.current = true;
      onReady?.();
    }
  });

  return (
    <>
      <ambientLight intensity={0.82} color="#c8d8ef" />
      <directionalLight
        ref={sunRef}
        position={[5, 8.5, 4.5]}
        intensity={1.35}
        color="#fff7d6"
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.32} color="#93c5fd" />
      <hemisphereLight args={["#dbeafe", "#1e293b", 0.48]} />
      <SkyBackdrop />
      <CloudDeck />
      <group ref={mountainRef}>
        <DamavandMountain textureUrl={textureUrl} />
      </group>
    </>
  );
}

export function HomeHeroMountainCanvas({
  onContextLost,
  onReady,
  ...props
}: HomeHeroMountainCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0.35, 3.05, 12.5], fov: 32 }}
      className="mkt-hero-canvas"
      dpr={[1, 1.25]}
      resize={{ debounce: 0, scroll: false }}
      gl={{
        alpha: false,
        antialias: true,
        toneMapping: NoToneMapping,
        outputColorSpace: SRGBColorSpace,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
      }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x0b1220, 1);
        gl.toneMapping = NoToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        const canvas = gl.domElement;
        canvas.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            onContextLost?.();
          },
          { once: true }
        );
        window.requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
      }}
    >
      <CanvasResizeSync />
      <CinematicRig {...props} onReady={onReady} />
    </Canvas>
  );
}
