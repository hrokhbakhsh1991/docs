import assert from "node:assert/strict";
import test from "node:test";

import { CURRENT_DRAFT_SCHEMA_VERSION } from "@repo/shared-contracts";
import { DefaultDraftConflictResolver } from "./default-draft-conflict-resolver";

test("DefaultDraftConflictResolver delegates to deterministic merge", () => {
  const resolver = new DefaultDraftConflictResolver();
  const result = resolver.resolveMergeConflict(
    {
      data: { note: "client" },
      version: 1,
      schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
      lastModified: 2000,
    },
    {
      data: { note: "server" },
      version: 2,
      schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
      lastModified: 1000,
    }
  );

  assert.equal((result.merged.data as { note: string }).note, "client");
  assert.equal(result.merged.version, 2);
});
