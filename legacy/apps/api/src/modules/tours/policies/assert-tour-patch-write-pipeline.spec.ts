import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { defineAbilityFor, WorkspaceRole } from "@repo/shared";

import { assertTourPatchWritePreMerge } from "./assert-tour-patch-write-pipeline";
import type { UpdateTourDto } from "../dto/update-tour.dto";

test("pipeline rejects member patching total_capacity before service", () => {
  const ability = defineAbilityFor({
    id: "u1",
    role: WorkspaceRole.Member,
    status: "ACTIVE",
    capabilities: ["tour.update.core", "tour.update"],
  });

  assert.throws(
    () =>
      assertTourPatchWritePreMerge({
        ability,
        workspaceRole: WorkspaceRole.Member,
        capabilities: ["tour.update.core"],
        dto: { total_capacity: 10 } as UpdateTourDto,
      }),
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenException);
      const body = err.getResponse() as { error?: { code?: string } };
      return body.error?.code === "TOUR_PATCH_FIELD_FORBIDDEN";
    },
  );
});

test("pipeline allows leader core + tripDetails patch", () => {
  const ability = defineAbilityFor({
    id: "u1",
    role: WorkspaceRole.Leader,
    status: "ACTIVE",
  });

  assert.doesNotThrow(() =>
    assertTourPatchWritePreMerge({
      ability,
      workspaceRole: WorkspaceRole.Leader,
      dto: {
        title: "x",
        tripDetails: { overview: { shortIntro: "hi" } },
      } as UpdateTourDto,
    }),
  );
});
