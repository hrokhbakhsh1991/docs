import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeWorkspaceFieldRegistryWithTransportFragments } from "@app-tour/workspace-sdk";
import { resolveWorkspaceTransportFieldRegistryFragment } from "../../../../apps/web/src/bootstrap/workspace-transport-field-module-bindings.generated";

import {
  denaliTransportFieldRegistryFragment,
  DENALI_TRANSPORT_MODE_CANONICAL_PATH,
} from "../src/field-registry/denali-transport-field-module";
import { buildDenaliWorkspaceFieldRegistry } from "../src/denali-plugin-adapter";

describe("denali-transport-field-parity (CW7-07)", () => {
  it("manifest fieldModule fragment contains transport-mode composite anchor only", () => {
    assert.equal(denaliTransportFieldRegistryFragment.fields.length, 1);
    assert.equal(
      denaliTransportFieldRegistryFragment.fields[0]?.canonicalPath,
      DENALI_TRANSPORT_MODE_CANONICAL_PATH
    );
    assert.equal(denaliTransportFieldRegistryFragment.fields[0]?.id, "denali.transport-mode");
  });

  it("fragment matches full registry transport-mode row (Denali parity golden)", () => {
    const fullRegistry = buildDenaliWorkspaceFieldRegistry();
    const transportFromFull = fullRegistry.fields.find(
      (field) => field.canonicalPath === DENALI_TRANSPORT_MODE_CANONICAL_PATH
    );
    assert.ok(transportFromFull);
    assert.deepEqual(denaliTransportFieldRegistryFragment.fields[0], transportFromFull);
  });

  it("codegen binding resolves denali fragment; starter isolated", () => {
    const denaliFragment = resolveWorkspaceTransportFieldRegistryFragment("denali");
    assert.ok(denaliFragment);
    assert.equal(denaliFragment?.fields.length, 1);
    assert.equal(resolveWorkspaceTransportFieldRegistryFragment("starter"), undefined);
    assert.equal(resolveWorkspaceTransportFieldRegistryFragment("urban"), undefined);
    assert.equal(resolveWorkspaceTransportFieldRegistryFragment("guest-club"), undefined);
  });

  it("merge seam replaces transport-mode row without duplicating ids", () => {
    const base = buildDenaliWorkspaceFieldRegistry();
    const merged = mergeWorkspaceFieldRegistryWithTransportFragments(
      base,
      denaliTransportFieldRegistryFragment
    );
    assert.equal(merged.fields.length, base.fields.length);
    const transportMerged = merged.fields.find(
      (field) => field.canonicalPath === DENALI_TRANSPORT_MODE_CANONICAL_PATH
    );
    assert.ok(transportMerged);
    assert.deepEqual(transportMerged, denaliTransportFieldRegistryFragment.fields[0]);
  });
});
