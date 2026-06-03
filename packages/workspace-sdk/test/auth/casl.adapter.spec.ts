import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AbilityAction } from "../../src/auth/actions.js";
import { defineAbilityFor } from "../../src/auth/casl/index.js";
import { caslWorkspaceThemeSubject } from "../../src/auth/casl/subjects.js";
import {
  createFreshAbility,
  harnessMemberContext,
  HARNESS_TENANT_A,
} from "../lib/immutable-harness.js";

describe("auth/casl adapter", () => {
  it("does not grant access on bare subject type without instance conditions", () => {
    const ability = createFreshAbility(harnessMemberContext(HARNESS_TENANT_A));
    assert.equal(ability.can(AbilityAction.Access, "WorkspaceTheme"), false);
  });

  it("defineAbilityFor grants workspace theme access for harness member", () => {
    const ctx = harnessMemberContext(HARNESS_TENANT_A);
    const ability = defineAbilityFor(ctx);
    assert.equal(
      ability.can(
        AbilityAction.Access,
        caslWorkspaceThemeSubject({
          tenantId: ctx.tenantId,
          workspaceId: ctx.workspaceId!,
          pluginId: "starter",
        }),
      ),
      true,
    );
  });
});
