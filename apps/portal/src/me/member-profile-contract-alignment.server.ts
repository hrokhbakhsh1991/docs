import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MEMBER_PROFILE_FIELD_IDS } from "@app-tour/workspace-sdk";

type MemberProfileContractSnapshot = {
  readonly contractVersion: string;
  readonly memberProfileFieldIds: readonly string[];
};

const SNAPSHOT_FILE_NAME = "member-profile-contract-v1.snapshot.json";

/** Resolve snapshot for dev (src sibling), Next bundle, and standalone artifact layouts. */
export function resolveMemberProfileContractSnapshotPath(): string {
  const envOverride = process.env.MEMBER_PROFILE_CONTRACT_SNAPSHOT_PATH?.trim();
  if (envOverride !== undefined && envOverride.length > 0 && existsSync(envOverride)) {
    return envOverride;
  }

  const moduleSibling = join(
    dirname(fileURLToPath(import.meta.url)),
    SNAPSHOT_FILE_NAME
  );
  if (existsSync(moduleSibling)) {
    return moduleSibling;
  }

  // Next standalone server.js chdirs to apps/<app>; snapshot ships at src/me/ beside server root.
  const standaloneAppRelative = join(process.cwd(), "src/me", SNAPSHOT_FILE_NAME);
  if (existsSync(standaloneAppRelative)) {
    return standaloneAppRelative;
  }

  const artifactRelative = join(process.cwd(), "apps/portal/src/me", SNAPSHOT_FILE_NAME);
  if (existsSync(artifactRelative)) {
    return artifactRelative;
  }

  throw new Error("MEMBER_PROFILE_CONTRACT_SNAPSHOT_MISSING");
}

function readContractSnapshot(): MemberProfileContractSnapshot {
  const raw = JSON.parse(
    readFileSync(resolveMemberProfileContractSnapshotPath(), "utf8")
  ) as MemberProfileContractSnapshot;
  return raw;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/** Runtime alignment check — snapshot field ids vs SDK frozen field-id list. */
export function assertMemberProfileContractSnapshotAlignment(): void {
  const snapshot = readContractSnapshot();
  const sdkFieldIds = sortedUnique(MEMBER_PROFILE_FIELD_IDS);
  const snapshotFieldIds = sortedUnique(snapshot.memberProfileFieldIds);

  if (snapshot.contractVersion !== "v1") {
    throw new Error("MEMBER_PROFILE_CONTRACT_SNAPSHOT_VERSION_MISMATCH");
  }

  if (sdkFieldIds.join("|") !== snapshotFieldIds.join("|")) {
    throw new Error("MEMBER_PROFILE_CONTRACT_FIELD_DRIFT");
  }
}

export function readMemberProfileContractSnapshot(): MemberProfileContractSnapshot {
  return readContractSnapshot();
}
