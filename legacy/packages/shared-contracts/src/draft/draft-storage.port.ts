import type { DraftSnapshot } from "./draft-snapshot.contract";

/** Workspace-scoped draft identity (domain-agnostic; not tied to Tour entities). */
export type DraftScope = {
  readonly workspaceId: string;
  readonly userId: string;
  readonly   draftKey: string;
};

/** MAP alias: any entity addressable by workspace + user + draft key. */
export type Draftable = DraftScope;

export function toDraftScope(
  workspaceId: string,
  userId: string,
  draftKey: string,
): DraftScope {
  return {
    workspaceId: workspaceId.trim().toLowerCase(),
    userId: userId.trim(),
    draftKey: draftKey.trim(),
  };
}

/**
 * Persistence adapter for draft snapshots (Postgres today; Redis or other backends later).
 */
export type DraftStoragePort = {
  find(_scope: DraftScope): Promise<DraftSnapshot | null>;
  upsert(_scope: DraftScope, _snapshot: DraftSnapshot): Promise<DraftSnapshot>;
  delete(_scope: DraftScope): Promise<void>;
  /**
   * Upgrade `data` + `schemaVersion` without bumping OCC `version` (used after read-time migration).
   */
  upgradeSchemaInPlace(
    _scope: DraftScope,
    _input: Pick<DraftSnapshot, "data" | "schemaVersion" | "version">,
  ): Promise<DraftSnapshot | null>;
};
