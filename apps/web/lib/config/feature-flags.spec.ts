/* eslint-disable react-hooks/rules-of-hooks --
 * `useUnifiedTourDomainProfileForEditResolver` is a plain function (env-var reader),
 * not a React hook — its `use*` prefix is legacy. The rules-of-hooks check fires false
 * positives when we call it inside a `for` loop, which is exactly what these tests do.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  leaderDashboardUseAggregateApi,
  legacyEditResolverKillSwitchEnabled,
  useUnifiedTourDomainProfileForEditResolver,
} from "./feature-flags";

/**
 * The env-var-driven flags are pure functions over `process.env`. Tests mutate
 * `process.env` inside a try/finally so they never leak state to other specs.
 * We use distinct keys per assertion to avoid order coupling.
 *
 * Phase P7 (promptq.md): `useUnifiedTourDomainProfileForEditResolver` flipped from
 * "opt-in" to "opt-out". The opt-out kill switch is
 * `NEXT_PUBLIC_LEGACY_EDIT_RESOLVER_ENABLED` (or `LEGACY_EDIT_RESOLVER_ENABLED`).
 */

function clearTourEnv(): void {
  delete process.env.NEXT_PUBLIC_LEGACY_EDIT_RESOLVER_ENABLED;
  delete process.env.LEGACY_EDIT_RESOLVER_ENABLED;
}

test("useUnifiedTourDomainProfileForEditResolver: default is ON (Phase P7 flip)", () => {
  clearTourEnv();
  assert.equal(useUnifiedTourDomainProfileForEditResolver(), true);
});

test("legacyEditResolverKillSwitchEnabled: NEXT_PUBLIC variant disables unified path", () => {
  clearTourEnv();
  process.env.NEXT_PUBLIC_LEGACY_EDIT_RESOLVER_ENABLED = "1";
  try {
    assert.equal(legacyEditResolverKillSwitchEnabled(), true);
    assert.equal(
      useUnifiedTourDomainProfileForEditResolver(),
      false,
      "kill switch should force unified resolver OFF",
    );
  } finally {
    clearTourEnv();
  }
});

test("legacyEditResolverKillSwitchEnabled: non-public variant also disables (build-time override)", () => {
  clearTourEnv();
  process.env.LEGACY_EDIT_RESOLVER_ENABLED = "true";
  try {
    assert.equal(legacyEditResolverKillSwitchEnabled(), true);
    assert.equal(useUnifiedTourDomainProfileForEditResolver(), false);
  } finally {
    clearTourEnv();
  }
});

test("kill switch: case- and whitespace-insensitive truthy values", () => {
  for (const raw of ["1", "true", "TRUE", "  yes  ", "On"]) {
    clearTourEnv();
    process.env.NEXT_PUBLIC_LEGACY_EDIT_RESOLVER_ENABLED = raw;
    try {
      assert.equal(
        legacyEditResolverKillSwitchEnabled(),
        true,
        `raw=${JSON.stringify(raw)} should engage the kill switch`,
      );
      assert.equal(useUnifiedTourDomainProfileForEditResolver(), false);
    } finally {
      clearTourEnv();
    }
  }
});

test("kill switch: falsy / nonsense values keep unified path ON", () => {
  for (const raw of ["", "0", "false", "off", "no", "maybe", "asdf"]) {
    clearTourEnv();
    process.env.NEXT_PUBLIC_LEGACY_EDIT_RESOLVER_ENABLED = raw;
    try {
      assert.equal(
        legacyEditResolverKillSwitchEnabled(),
        false,
        `raw=${JSON.stringify(raw)} should not engage the kill switch`,
      );
      assert.equal(useUnifiedTourDomainProfileForEditResolver(), true);
    } finally {
      clearTourEnv();
    }
  }
});

test("leaderDashboardUseAggregateApi: defaults on; explicit false opts out", () => {
  delete process.env.NEXT_PUBLIC_LEADER_DASHBOARD_USE_AGGREGATE_API;
  delete process.env.LEADER_DASHBOARD_USE_AGGREGATE_API;
  assert.equal(leaderDashboardUseAggregateApi(), true);
  process.env.NEXT_PUBLIC_LEADER_DASHBOARD_USE_AGGREGATE_API = "false";
  try {
    assert.equal(leaderDashboardUseAggregateApi(), false);
  } finally {
    delete process.env.NEXT_PUBLIC_LEADER_DASHBOARD_USE_AGGREGATE_API;
  }
});
