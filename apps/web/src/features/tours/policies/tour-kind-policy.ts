import {
  resolveEventKindFromTourContext,
  type EventKind,
  type EventKindResolverInput,
} from "@repo/types";

export type MountainTourKindInput = EventKindResolverInput;

export { resolveEventKindFromTourContext };
export type { EventKind };

/** Compatibility helper used by existing validation gates. */
export function isMountainTourLike(input: MountainTourKindInput): boolean {
  return resolveEventKindFromTourContext(input) === "mountain";
}

