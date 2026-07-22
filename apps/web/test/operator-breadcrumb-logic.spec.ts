/**
 * Operator header breadcrumb path resolution.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveOperatorBreadcrumbSegments } from "../src/admin/shell/operator-breadcrumb-logic";

describe("operator-breadcrumb-logic.spec.ts", () => {
  it("resolves top-level nav routes", () => {
    const segments = resolveOperatorBreadcrumbSegments("/tours");
    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.namespace, "nav");
    assert.equal(segments[0]?.key, "tours");
  });

  it("resolves nested settings modules", () => {
    const segments = resolveOperatorBreadcrumbSegments("/settings/equipment");
    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.href, "/settings");
    assert.equal(segments[1]?.key, "modules.equipment.title");
  });

  it("resolves workspace-owner settings module (Gap Closure B.17)", () => {
    const segments = resolveOperatorBreadcrumbSegments("/settings/workspace-owner");
    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.href, "/settings");
    assert.equal(segments[1]?.namespace, "settings");
    assert.equal(segments[1]?.key, "workspaceOwner.title");
  });

  it("resolves tours new wizard trail", () => {
    const segments = resolveOperatorBreadcrumbSegments("/tours/new");
    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.href, "/tours");
    assert.equal(segments[1]?.key, "newTour");
  });
});
