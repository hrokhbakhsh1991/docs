"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

type RoutePoint = {
  readonly label: string;
  readonly position: [number, number, number];
};

type TerrainField = {
  readonly surfaceAt: (x: number, z: number) => number;
};

const MOUNTAIN_SIZE = 46;
const MOUNTAIN_RADIAL_SEGMENTS = 48;
const MOUNTAIN_ANGULAR_SEGMENTS = 96;

function createHeightmapTerrainField(texture: THREE.Texture): TerrainField {
  const volcanicBase = createProceduralTerrainField();
  const image = texture.image as HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Damavand heightmap canvas is unavailable");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  return {
    surfaceAt: (x, z) => {
      const u = Math.max(0, Math.min(1, x / MOUNTAIN_SIZE + 0.5));
      // The camera faces the southern slope: image south (larger v) is +z.
      const v = Math.max(0, Math.min(1, z / MOUNTAIN_SIZE + 0.5));
      const px = Math.min(image.width - 1, Math.round(u * (image.width - 1)));
      const py = Math.min(image.height - 1, Math.round(v * (image.height - 1)));
      const elevation = pixels[(py * image.width + px) * 4] / 255;
      const radius = Math.sqrt(x * x + z * z) / (MOUNTAIN_SIZE * 0.5);
      const edgeTaper = Math.max(0, Math.min(1, (1 - radius) / 0.35));
      const demHeight = elevation * 20 * edgeTaper - 2.8;
      // Let the measured relief define the silhouette; procedural relief only
      // fills the gaps between DEM samples so the result keeps Damavand's
      // broad volcanic cone instead of turning into a generic jagged peak.
      const baseHeight = volcanicBase.surfaceAt(x, z) * 0.38 + demHeight * 0.62;
      const summitRadius = Math.sqrt(x * x + z * z);
      const craterBowl = Math.max(0, 1 - summitRadius / 1.7);
      const craterRim = Math.exp(-((summitRadius - 1.5) ** 2) / 0.09) * 0.55;
      return baseHeight - craterBowl * 2.1 + craterRim;
    },
  };
}

function createProceduralTerrainField(): TerrainField {
  return {
    surfaceAt: (x, z) => {
      const radius = Math.sqrt(x * x + z * z) / (MOUNTAIN_SIZE * 0.5);
      const angle = Math.atan2(z, x);
      const falloff = Math.max(0, 1 - radius);
      const ridge = Math.sin(angle * 8 + radius * 18) * falloff * 0.9;
      const texture = Math.sin(x * 0.52) * Math.cos(z * 0.42) * falloff * 0.35;
      const baseHeight = Math.max(0, Math.pow(falloff, 1.55) * 18 + ridge + texture) - 2.8;
      const summitRadius = Math.sqrt(x * x + z * z);
      const craterBowl = Math.max(0, 1 - summitRadius / 1.7);
      const craterRim = Math.exp(-((summitRadius - 1.5) ** 2) / 0.09) * 0.55;
      return baseHeight - craterBowl * 2.1 + craterRim;
    },
  };
}

function routePoint(label: string, x: number, z: number, terrain: TerrainField): RoutePoint {
  // Keep the route on the camera-facing slope so it remains legible above the mesh.
  return { label, position: [x, terrain.surfaceAt(x, z) + 0.5, z + 0.65] };
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

  for (let radialIndex = 0; radialIndex <= MOUNTAIN_RADIAL_SEGMENTS; radialIndex += 1) {
    const radius = (radialIndex / MOUNTAIN_RADIAL_SEGMENTS) * (MOUNTAIN_SIZE * 0.3);
    for (let angularIndex = 0; angularIndex < MOUNTAIN_ANGULAR_SEGMENTS; angularIndex += 1) {
      const angle = (angularIndex / MOUNTAIN_ANGULAR_SEGMENTS) * Math.PI * 2;
      const silhouette = 1 + Math.sin(angle * 3 + 0.4) * 0.065 + Math.cos(angle * 5) * 0.035;
      const shapedRadius = radius * silhouette;
      const x = Math.cos(angle) * shapedRadius;
      const z = Math.sin(angle) * shapedRadius;
      const surface = terrain.surfaceAt(x, z);
      const height = surface + 2.8;
      const radialProgress = radialIndex / MOUNTAIN_RADIAL_SEGMENTS;
      const isOuterRing = radialIndex === MOUNTAIN_RADIAL_SEGMENTS;
      const edgeBlend = Math.max(0, Math.min(1, (radialProgress - 0.86) / 0.14));
      const vertexHeight = surface * (1 - edgeBlend) + -3.05 * edgeBlend;

      positions.push(x, vertexHeight, z);
      const normalizedHeight = Math.max(0, Math.min(1, height / 18));
      if (isOuterRing) {
        color.set("#07131c");
      } else {
        color.setHSL(0.56 - normalizedHeight * 0.04, 0.2, 0.22 + normalizedHeight * 0.38);
        // The inset is intentionally stylised, but its upper cone must read as
        // a snow-capped Damavand rather than an anonymous dark volcano.
        const snowline = Math.max(0, Math.min(1, (normalizedHeight - 0.1) / 0.3));
        const snowPattern = 0.72 + 0.28 * ((Math.sin(angle * 5 + radius * 0.9) + 1) / 2);
        color.lerp(snowColor, snowline * snowPattern * 0.92);
      }
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let radialIndex = 0; radialIndex < MOUNTAIN_RADIAL_SEGMENTS; radialIndex += 1) {
    for (let angularIndex = 0; angularIndex < MOUNTAIN_ANGULAR_SEGMENTS; angularIndex += 1) {
      const nextAngle = (angularIndex + 1) % MOUNTAIN_ANGULAR_SEGMENTS;
      const current = radialIndex * MOUNTAIN_ANGULAR_SEGMENTS + angularIndex;
      const nextRow = (radialIndex + 1) * MOUNTAIN_ANGULAR_SEGMENTS + angularIndex;
      const currentNextAngle = radialIndex * MOUNTAIN_ANGULAR_SEGMENTS + nextAngle;
      const nextRowNextAngle = (radialIndex + 1) * MOUNTAIN_ANGULAR_SEGMENTS + nextAngle;
      indices.push(current, currentNextAngle, nextRow, currentNextAngle, nextRowNextAngle, nextRow);
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
        roughness={0.94}
        metalness={0.04}
        emissive="#0b1e24"
        emissiveIntensity={0.42}
        transparent
        opacity={0.82}
        depthWrite={false}
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
        lineWidth={4}
        dashed
        dashSize={0.45}
        gapSize={0.22}
        depthTest={false}
        toneMapped={false}
        renderOrder={10}
      />
      {routePoints.map((point, index) => (
        <mesh key={point.label} position={point.position}>
          <sphereGeometry args={[index === routePoints.length - 1 ? 0.28 : 0.2, 16, 16]} />
          <meshBasicMaterial
            color={index === routePoints.length - 1 ? "#fff1b8" : "#f4b942"}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

function DamavandScene({ reducedMotion }: { readonly reducedMotion: boolean }) {
  const rotationAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const [heightmap, setHeightmap] = useState<THREE.Texture | null>(null);
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

  useFrame((state, delta) => {
    if (!reducedMotion) {
      state.camera.position.applyAxisAngle(rotationAxis, delta * 0.018);
      state.camera.lookAt(0, 4, 0);
    }
  });

  return (
    <>
      <fog attach="fog" args={["#07131c", 22, 62]} />
      <hemisphereLight intensity={1.45} color="#d7e8ee" groundColor="#07131c" />
      <ambientLight intensity={1.6} color="#b8d4dc" />
      <directionalLight position={[-10, 24, 8]} intensity={4.4} color="#ffe0a1" castShadow />
      <directionalLight position={[15, 12, -10]} intensity={1.7} color="#86b6ca" />
      <Stars radius={72} depth={32} count={900} factor={2.4} saturation={0.15} fade speed={0.18} />
      <Mountain terrain={terrain} />
      <AscentRoute terrain={terrain} />
      <OrbitControls
        enablePan={false}
        minDistance={25}
        maxDistance={58}
        minPolarAngle={Math.PI * 0.29}
        maxPolarAngle={Math.PI * 0.55}
        target={[0, 4, 0]}
      />
    </>
  );
}

export default function DamavandHero3D({ locale }: { readonly locale: "fa" | "en" }) {
  const [reducedMotion, setReducedMotion] = useState(false);
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

  return (
    <div data-damavand-hero-3d aria-label="نمای دماوند و مسیر صعود">
      <div data-damavand-hero-3d-stage>
        <Canvas
          camera={{ position: [34, 18, 42], fov: 42, near: 0.1, far: 140 }}
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
