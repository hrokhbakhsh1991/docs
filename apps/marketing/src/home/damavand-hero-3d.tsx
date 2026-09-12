"use client";

import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

type RoutePoint = {
  readonly label: string;
  readonly position: [number, number, number];
};

type TerrainField = {
  readonly surfaceAt: (x: number, z: number) => number;
  readonly elevation01At?: (x: number, z: number) => number;
};

const MOUNTAIN_SIZE = 48;
const MOUNTAIN_WIDTH = 58;
const MOUNTAIN_GRID_SEGMENTS = 120;

function createHeightmapTerrainField(texture: THREE.Texture): TerrainField {
  const image = texture.image as HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Damavand heightmap canvas is unavailable");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const sampleElevation = (su: number, sv: number) => {
    const fx = su * (image.width - 1);
    const fy = sv * (image.height - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, image.width - 1);
    const y1 = Math.min(y0 + 1, image.height - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const read = (px: number, py: number) => pixels[(py * image.width + px) * 4] / 255;
    return (
      read(x0, y0) * (1 - tx) * (1 - ty) +
      read(x1, y0) * tx * (1 - ty) +
      read(x0, y1) * (1 - tx) * ty +
      read(x1, y1) * tx * ty
    );
  };
  return {
    surfaceAt: (x, z) => {
      const u = Math.max(0, Math.min(1, x / MOUNTAIN_WIDTH + 0.5));
      // The camera faces the southern slope: image south (larger v) is +z.
      const v = Math.max(0, Math.min(1, z / MOUNTAIN_SIZE + 0.5));
      const elevation = sampleElevation(u, v);
      const edgeInset = Math.min(u, 1 - u, v, 1 - v) * 2;
      const edgeTaper = edgeInset * edgeInset * (3 - 2 * edgeInset);
      const edgeTaperScale = Math.max(0, Math.min(1, edgeInset / 0.42));
      const taper = edgeTaper * edgeTaperScale;
      // Broad stratovolcano profile (wide base, defined summit) — not a symmetric needle cone.
      const broadBase = Math.pow(elevation, 0.56);
      const summitLift = 0.86 + Math.pow(elevation, 2.35) * 0.14;
      const shapedElevation = broadBase * summitLift;
      const demHeight = shapedElevation * 16.2 * taper - 2.6;
      const edgeFade = Math.pow(Math.max(0, 1 - taper), 2.1);
      const edgeDrop = edgeFade * 3.2;
      return demHeight - edgeDrop;
    },
    elevation01At: (x, z) => {
      const u = Math.max(0, Math.min(1, x / MOUNTAIN_WIDTH + 0.5));
      const v = Math.max(0, Math.min(1, z / MOUNTAIN_SIZE + 0.5));
      const edgeInset = Math.min(u, 1 - u, v, 1 - v) * 2;
      const edgeTaper = edgeInset * edgeInset * (3 - 2 * edgeInset);
      const edgeTaperScale = Math.max(0, Math.min(1, edgeInset / 0.42));
      return sampleElevation(u, v) * edgeTaper * edgeTaperScale;
    },
  };
}

function createProceduralTerrainField(): TerrainField {
  return {
    surfaceAt: (x, z) => {
      const u = Math.max(0, Math.min(1, x / MOUNTAIN_SIZE + 0.5));
      const v = Math.max(0, Math.min(1, z / MOUNTAIN_SIZE + 0.5));
      const edgeInset = Math.min(u, 1 - u, v, 1 - v) * 2;
      const edgeTaper = Math.max(0, Math.min(1, edgeInset / 0.38));
      const falloff = Math.pow(edgeTaper, 1.15);
      return Math.pow(falloff, 1.05) * 16.5 - 2.6;
    },
  };
}

function routePoint(label: string, x: number, z: number, terrain: TerrainField): RoutePoint {
  const y = terrain.surfaceAt(x, z);
  return { label, position: [x, y + 0.12, z + 0.02] };
}

const ROUTE_COORDINATES = [
  ["پلور", -8, 6],
  ["گوسفندسرا", -5.5, 4.2],
  ["بارگاه سوم", -2.8, 2.2],
  ["قله دماوند", 0.1, 0.1],
] as const;

function createMountainGeometry(terrain: TerrainField): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();
  const snowColor = new THREE.Color("#fff9e8");
  const grid = MOUNTAIN_GRID_SEGMENTS;

  for (let row = 0; row <= grid; row += 1) {
    for (let col = 0; col <= grid; col += 1) {
      const u = col / grid;
      const v = row / grid;
      const x = (u - 0.5) * MOUNTAIN_WIDTH;
      const z = (v - 0.5) * MOUNTAIN_SIZE;
      const surface = terrain.surfaceAt(x, z);
      const height = surface + 2.6;

      positions.push(x, surface, z);
      const normalizedHeight = Math.max(0, Math.min(1, height / 17.5));
      const dem01 = terrain.elevation01At?.(x, z) ?? normalizedHeight;
      const rockLight = 0.38 + normalizedHeight * 0.34;
      color.setHSL(0.54 - normalizedHeight * 0.05, 0.22, rockLight);
      // Snow cap: mesh height + summit radial focus (avoids DEM iso-elevation rings on shoulders).
      const radial01 = Math.min(1, Math.hypot(x / 24, z / 17));
      const summitWeight = 1 - radial01 * radial01;
      const snowDriver = normalizedHeight * (0.58 + summitWeight * 0.42) + dem01 * 0.08;
      const snowT = Math.max(0, Math.min(1, (snowDriver - 0.54) / 0.36));
      const snowBlend = snowT * snowT * (3 - 2 * snowT);
      color.lerp(snowColor, snowBlend * 0.9);
      colors.push(color.r, color.g, color.b);
    }
  }

  const minVisibleY = -0.95;

  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const current = row * (grid + 1) + col;
      const nextCol = current + 1;
      const nextRow = (row + 1) * (grid + 1) + col;
      const nextRowNextCol = nextRow + 1;
      const pushTriangle = (a: number, b: number, c: number) => {
        const ya = positions[a * 3 + 1];
        const yb = positions[b * 3 + 1];
        const yc = positions[c * 3 + 1];
        if (ya <= minVisibleY && yb <= minVisibleY && yc <= minVisibleY) return;
        indices.push(a, b, c);
      };
      pushTriangle(current, nextCol, nextRow);
      pushTriangle(nextCol, nextRowNextCol, nextRow);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Mountain({ terrain }: { readonly terrain: TerrainField }) {
  const geometry = useMemo(() => createMountainGeometry(terrain), [terrain]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
      <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.86}
        metalness={0.02}
        emissive="#1a3540"
        emissiveIntensity={0.05}
      />
    </mesh>
  );
}

function AscentRoute({ terrain }: { readonly terrain: TerrainField }) {
  const routePoints = useMemo(
    () => ROUTE_COORDINATES.map(([label, x, z]) => routePoint(label, x, z, terrain)),
    [terrain]
  );
  const route = useMemo(() => routePoints.map((point) => point.position), [routePoints]);
  return (
    <>
      <Line
        points={route}
        color="#f4b942"
        lineWidth={3.5}
        dashed
        dashSize={0.4}
        gapSize={0.2}
        depthTest
        toneMapped={false}
        renderOrder={2}
      />
      {routePoints.map((point, index) => (
        <mesh key={point.label} position={point.position}>
          <sphereGeometry args={[index === routePoints.length - 1 ? 0.22 : 0.16, 12, 12]} />
          <meshBasicMaterial
            color={index === routePoints.length - 1 ? "#fff1b8" : "#f4b942"}
            depthTest
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

function DamavandScene({ reducedMotion }: { readonly reducedMotion: boolean }) {
  const [heightmap, setHeightmap] = useState<THREE.Texture | null>(null);
  const [compactStage, setCompactStage] = useState(false);
  const fallbackTerrain = useMemo(createProceduralTerrainField, []);
  const terrain = useMemo(
    () => (heightmap ? createHeightmapTerrainField(heightmap) : fallbackTerrain),
    [fallbackTerrain, heightmap]
  );

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(
      "/home/damavand-heightmap.png",
      () => setHeightmap(texture),
      undefined,
      () => setHeightmap(null)
    );
    return () => texture.dispose();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 48rem)");
    const update = () => setCompactStage(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const lookTarget = compactStage ? ([0, 4.8, 1.6] as const) : ([0, 4.5, 2.1] as const);
  const groupScale = compactStage ? ([1.18, 1.12, 1.14] as const) : ([1.14, 1.06, 1.1] as const);
  const groupPosition = compactStage ? ([0, -0.58, 0.08] as const) : ([0, -0.78, 0.12] as const);

  return (
    <>
      <fog attach="fog" args={["#2d4a55", 42, 95]} />
      <hemisphereLight intensity={1.65} color="#eef6fa" groundColor="#24343a" />
      <ambientLight intensity={2.15} color="#dce9ef" />
      <directionalLight position={[8, 28, 36]} intensity={6.1} color="#ffe9c4" castShadow />
      <directionalLight position={[-14, 16, -6]} intensity={1.45} color="#8ec0d4" />
      <group scale={groupScale} position={groupPosition}>
        <Mountain terrain={terrain} />
        <AscentRoute terrain={terrain} />
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={17}
        maxDistance={48}
        minPolarAngle={Math.PI * 0.33}
        maxPolarAngle={Math.PI * 0.5}
        minAzimuthAngle={-0.55}
        maxAzimuthAngle={0.55}
        enableRotate={!reducedMotion}
        target={lookTarget}
      />
    </>
  );
}

export default function DamavandHero3D({ locale }: { readonly locale: "fa" | "en" }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [compactStage, setCompactStage] = useState(false);
  const copy =
    locale === "fa"
      ? {
          altitudeLabel: "ارتفاع",
          altitude: "۵٬۶۱۰ متر",
          locationLabel: "موقعیت",
          location: "رشته‌کوه البرز",
          routeLabel: "مسیر صعود",
          route: "مسیر جنوبی",
          hint: "برای چرخش، تصویر را بکشید",
        }
      : {
          altitudeLabel: "Altitude",
          altitude: "5,610 m",
          locationLabel: "Location",
          location: "Alborz range",
          routeLabel: "Ascent route",
          route: "Southern route",
          hint: "Drag to explore",
        };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 48rem)");
    const update = () => setCompactStage(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const cameraProps = compactStage
    ? { position: [1.2, 15.2, 28] as const, fov: 36 }
    : { position: [2.4, 12.8, 31] as const, fov: 38 };

  return (
    <div data-damavand-hero-3d aria-label="نمای دماوند و مسیر صعود">
      <div data-damavand-hero-3d-stage>
        <Canvas
          camera={{ ...cameraProps, near: 0.1, far: 140 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          fallback={
            <div data-damavand-hero-canvas-fallback aria-hidden="true">
              <img src="/home/damavand-reference.jpg" alt="" />
            </div>
          }
        >
          <DamavandScene reducedMotion={reducedMotion} />
        </Canvas>
        <span data-damavand-hero-3d-stage-label>
          {locale === "fa" ? "مدل ارتفاعی تعاملی" : "Interactive terrain model"}
        </span>
      </div>
      <aside
        data-damavand-hero-facts
        aria-label={locale === "fa" ? "اطلاعات دماوند" : "Damavand facts"}
      >
        <div data-damavand-hero-fact>
          <span>{copy.altitudeLabel}</span>
          <strong>{copy.altitude}</strong>
        </div>
        <div data-damavand-hero-fact>
          <span>{copy.locationLabel}</span>
          <strong>{copy.location}</strong>
        </div>
        <div data-damavand-hero-fact>
          <span>{copy.routeLabel}</span>
          <strong>{copy.route}</strong>
        </div>
      </aside>
      <div data-damavand-hero-hint>{copy.hint}</div>
    </div>
  );
}
