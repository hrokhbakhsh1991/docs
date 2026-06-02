import test from "node:test";
import assert from "node:assert/strict";

import { tourMetadataWireSchema } from "./tour-metadata-wire.schema";
import { tourPatchPostContractSchema } from "./tour-patch-post-contract";

test("tourMetadataWireSchema rejects unknown metadata keys", () => {
  const result = tourMetadataWireSchema.safeParse({
    vertical: "mountain_outdoor",
    stageCount: 2,
    ghostField: true,
  });
  assert.equal(result.success, false);
});

test("tourMetadataWireSchema accepts staging_shell vertical", () => {
  const result = tourMetadataWireSchema.safeParse({
    vertical: "staging_shell",
    isStagingShell: true,
  });
  assert.equal(result.success, true);
});

test("tourPatchPostContractSchema rejects unknown root keys", () => {
  const result = tourPatchPostContractSchema.safeParse({
    title: "Valid tour title here",
    stagingTourId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  assert.equal(result.success, false);
});

test("tourPatchPostContractSchema accepts partial PATCH payload", () => {
  const result = tourPatchPostContractSchema.safeParse({
    title: "Valid tour title here",
    lifecycle_status: "OPEN",
    metadata: { vertical: "urban_event", stageCount: 1 },
  });
  assert.equal(result.success, true);
});
