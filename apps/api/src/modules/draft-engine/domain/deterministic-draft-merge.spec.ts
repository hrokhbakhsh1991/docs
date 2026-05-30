import assert from "node:assert/strict";
import test from "node:test";

import { CURRENT_DRAFT_SCHEMA_VERSION } from "@repo/shared-contracts";
import { deterministicDraftMerge } from "./deterministic-draft-merge";

test("deterministicDraftMerge applies Denali client-wins rules for wizard fields", () => {
  const clientDraft = {
    data: {
      form: { basicInfo: { title: "Client title" }, timing: { startDate: "2026-06-01" } },
      currentStepIndex: 2,
      railLayoutVersion: 2,
      registryLayoutVersion: 3,
    },
    version: 1,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: 2000,
  };
  const serverDraft = {
    data: {
      form: { basicInfo: { title: "Server title", tourType: "HIKE" }, timing: { startDate: "2026-05-01" } },
      currentStepIndex: 1,
      railLayoutVersion: 3,
      registryLayoutVersion: 2,
    },
    version: 4,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: 1000,
  };

  const result = deterministicDraftMerge(clientDraft, serverDraft);
  assert.equal(result.merged.version, 4);
  assert.equal((result.merged.data as { currentStepIndex: number }).currentStepIndex, 2);
  assert.equal((result.merged.data as { railLayoutVersion: number }).railLayoutVersion, 3);
  assert.equal((result.merged.data as { registryLayoutVersion: number }).registryLayoutVersion, 3);
  assert.equal(
    (result.merged.data as { form: { basicInfo: { title: string } } }).form.basicInfo.title,
    "Client title"
  );
  assert.equal(result.hadConflicts, true);
  assert.ok(result.conflicts.some((c) => c.path === "data.currentStepIndex"));
});

test("deterministicDraftMerge merges generic payloads with lastModified tie-break", () => {
  const clientDraft = {
    data: { alpha: "client", beta: "shared" },
    version: 2,
    schemaVersion: 1,
    lastModified: 3000,
  };
  const serverDraft = {
    data: { alpha: "server", beta: "shared", gamma: "server-only" },
    version: 5,
    schemaVersion: 2,
    lastModified: 1000,
  };

  const result = deterministicDraftMerge(clientDraft, serverDraft);
  assert.equal(result.merged.version, 5);
  assert.equal(result.merged.schemaVersion, 2);
  assert.deepEqual(result.merged.data, {
    alpha: "client",
    beta: "shared",
    gamma: "server-only",
  });
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0]?.resolution, "client");
});

test("deterministicDraftMerge prefers server for generic leaf conflicts when server is newer", () => {
  const clientDraft = {
    data: { alpha: "client" },
    version: 2,
    schemaVersion: 1,
    lastModified: 1000,
  };
  const serverDraft = {
    data: { alpha: "server" },
    version: 5,
    schemaVersion: 1,
    lastModified: 5000,
  };

  const result = deterministicDraftMerge(clientDraft, serverDraft);
  assert.equal((result.merged.data as { alpha: string }).alpha, "server");
  assert.equal(result.conflicts[0]?.resolution, "server");
});

test("deterministicDraftMerge keeps non-overlapping keys from both sides", () => {
  const clientDraft = {
    data: { clientOnly: true },
    version: 1,
    schemaVersion: 1,
    lastModified: 1000,
  };
  const serverDraft = {
    data: { serverOnly: true },
    version: 3,
    schemaVersion: 1,
    lastModified: 1000,
  };

  const result = deterministicDraftMerge(clientDraft, serverDraft);
  assert.deepEqual(result.merged.data, { clientOnly: true, serverOnly: true });
  assert.equal(result.hadConflicts, false);
});
