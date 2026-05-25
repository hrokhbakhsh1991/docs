/** Shared registry types (imported by data + helpers). */

export type DenaliFieldKind = "standard" | "asyncAsset";

export type DenaliFieldWireProjection =
  | { kind: "tripDetails.overview"; field: string }
  | { kind: "tripDetails.logistics"; field: string }
  | { kind: "tripDetails.participation"; field: string }
  | { kind: "tripDetails"; field: "transport" | "photos" }
  | { kind: "createTourDto"; field: string }
  | { kind: "derived"; description: string };
