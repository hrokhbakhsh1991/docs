import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import { buildTourCloneIdempotencyScope } from "../../../src/modules/idempotency/tour-clone-idempotency.util";

test("buildTourCloneIdempotencyScope is stable for source + workspace", () => {
  const a = buildTourCloneIdempotencyScope({
    sourceTourId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    workspaceId: "tenant-1",
  });
  const b = buildTourCloneIdempotencyScope({
    sourceTourId: "  a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  ",
    workspaceId: " tenant-1 ",
  });
  assert.equal(a.endpoint, b.endpoint);
  assert.equal(a.path, b.path);
  assert.deepEqual(a.body, b.body);

  const hash = (scope: typeof a) =>
    createHash("sha256")
      .update(
        JSON.stringify({
          method: "POST",
          path: scope.path,
          body: scope.body,
        }),
      )
      .digest("hex");

  assert.equal(hash(a), hash(b));
  assert.notEqual(
    hash(a),
    hash(
      buildTourCloneIdempotencyScope({
        sourceTourId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22",
        workspaceId: "tenant-1",
      }),
    ),
  );
});
