import type { DraftSnapshot } from "./draft-snapshot.contract";

export type DraftFieldConflict = {
  readonly path: string;
  readonly clientValue: unknown;
  readonly serverValue: unknown;
  readonly resolvedValue: unknown;
  readonly resolution: "client" | "server" | "merged";
};

export type DraftMergeResult = {
  readonly merged: DraftSnapshot;
  readonly conflicts: readonly DraftFieldConflict[];
  readonly hadConflicts: boolean;
};
