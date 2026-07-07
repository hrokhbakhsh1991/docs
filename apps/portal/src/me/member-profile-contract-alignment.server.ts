import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MEMBER_PROFILE_FIELD_IDS } from "@app-tour/workspace-sdk";

type MemberProfileContractSnapshot = {
  readonly contractVersion: string;
  readonly memberProfileFieldIds: readonly string[];
};

const SNAPSHOT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "member-profile-contract-v1.snapshot.json"
);

function readContractSnapshot(): MemberProfileContractSnapshot {
  const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as MemberProfileContractSnapshot;
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
