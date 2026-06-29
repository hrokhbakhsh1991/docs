import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveFieldState } from "../../../src/field-policy/resolve-field-state.js";
import type { FieldDefinition, FieldPolicyRule } from "../../../src/field-policy/types";

const definitions: readonly FieldDefinition[] = [
  {
    id: "title",
    workspaceType: "starter",
    canonicalPath: "title",
    kind: "text",
    version: 1,
  },
  {
    id: "meetingPoint",
    workspaceType: "starter",
    canonicalPath: "logistics.meetingPoint",
    kind: "text",
    version: 1,
  },
  {
    id: "external",
    workspaceType: "other",
    canonicalPath: "external",
    kind: "text",
    version: 1,
  },
];

function rule(input: Omit<FieldPolicyRule, "workspaceType" | "surface" | "enabled">): FieldPolicyRule {
  return {
    workspaceType: "starter",
    surface: "public_website",
    enabled: true,
    ...input,
  };
}

describe("resolveFieldState", () => {
  it("defaults unmatched workspace fields to hidden", () => {
    const states = resolveFieldState({
      tenantId: "tenant-1",
      workspaceType: "starter",
      surface: "public_website",
      entityState: {},
      definitions,
      rules: [],
    });

    assert.deepEqual(states, [
      { fieldId: "meetingPoint", canonicalPath: "logistics.meetingPoint", state: "hidden" },
      { fieldId: "title", canonicalPath: "title", state: "hidden" },
    ]);
  });

  it("filters requested fields before resolving state", () => {
    const states = resolveFieldState({
      tenantId: "tenant-1",
      workspaceType: "starter",
      surface: "public_website",
      requestedFieldIds: ["title"],
      entityState: {},
      definitions,
      rules: [
        rule({ id: "title-visible", fieldId: "title", state: "visible", priority: 1 }),
        rule({
          id: "meeting-visible",
          fieldId: "meetingPoint",
          state: "visible",
          priority: 1,
        }),
      ],
    });

    assert.deepEqual(states, [
      {
        fieldId: "title",
        canonicalPath: "title",
        state: "visible",
        reasonRuleId: "title-visible",
      },
    ]);
  });

  it("applies simple conditions against entity state", () => {
    const states = resolveFieldState({
      tenantId: "tenant-1",
      workspaceType: "starter",
      surface: "public_website",
      requestedFieldIds: ["meetingPoint"],
      entityState: { tour: { status: "published" } },
      definitions,
      rules: [
        rule({
          id: "published-meeting",
          fieldId: "meetingPoint",
          state: "visible",
          priority: 1,
          condition: { kind: "equals", path: "tour.status", value: "published" },
        }),
      ],
    });

    assert.deepEqual(states, [
      {
        fieldId: "meetingPoint",
        canonicalPath: "logistics.meetingPoint",
        state: "visible",
        reasonRuleId: "published-meeting",
      },
    ]);
  });

  it("chooses the highest priority matching rule", () => {
    const states = resolveFieldState({
      tenantId: "tenant-1",
      workspaceType: "starter",
      surface: "public_website",
      requestedFieldIds: ["title"],
      entityState: {},
      definitions,
      rules: [
        rule({ id: "title-visible", fieldId: "title", state: "visible", priority: 1 }),
        rule({ id: "title-hidden", fieldId: "title", state: "hidden", priority: 10 }),
      ],
    });

    assert.deepEqual(states, [
      {
        fieldId: "title",
        canonicalPath: "title",
        state: "hidden",
        reasonRuleId: "title-hidden",
      },
    ]);
  });

  it("breaks equal-priority ties by state precedence", () => {
    const states = resolveFieldState({
      tenantId: "tenant-1",
      workspaceType: "starter",
      surface: "public_website",
      requestedFieldIds: ["title"],
      entityState: {},
      definitions,
      rules: [
        rule({ id: "title-visible", fieldId: "title", state: "visible", priority: 1 }),
        rule({ id: "title-required", fieldId: "title", state: "required", priority: 1 }),
      ],
    });

    assert.deepEqual(states, [
      {
        fieldId: "title",
        canonicalPath: "title",
        state: "required",
        reasonRuleId: "title-required",
      },
    ]);
  });

  it("is deterministic regardless of input order", () => {
    const rules: readonly FieldPolicyRule[] = [
      rule({ id: "title-required", fieldId: "title", state: "required", priority: 1 }),
      rule({ id: "meeting-visible", fieldId: "meetingPoint", state: "visible", priority: 1 }),
    ];

    const first = resolveFieldState({
      tenantId: "tenant-1",
      workspaceType: "starter",
      surface: "public_website",
      entityState: {},
      definitions: [...definitions].reverse(),
      rules: [...rules].reverse(),
    });
    const second = resolveFieldState({
      tenantId: "tenant-1",
      workspaceType: "starter",
      surface: "public_website",
      entityState: {},
      definitions,
      rules,
    });

    assert.deepEqual(first, second);
  });

  it("breaks fully equal rule ties by stable rule id", () => {
    const rules: readonly FieldPolicyRule[] = [
      rule({ id: "z-title-visible", fieldId: "title", state: "visible", priority: 1 }),
      rule({ id: "a-title-visible", fieldId: "title", state: "visible", priority: 1 }),
    ];

    const first = resolveFieldState({
      tenantId: "tenant-1",
      workspaceType: "starter",
      surface: "public_website",
      requestedFieldIds: ["title"],
      entityState: {},
      definitions,
      rules,
    });
    const second = resolveFieldState({
      tenantId: "tenant-1",
      workspaceType: "starter",
      surface: "public_website",
      requestedFieldIds: ["title"],
      entityState: {},
      definitions,
      rules: [...rules].reverse(),
    });

    assert.deepEqual(first, second);
    assert.equal(first[0]?.reasonRuleId, "a-title-visible");
  });
});
