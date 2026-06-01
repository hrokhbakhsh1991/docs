import assert from "node:assert/strict";
import test from "node:test";

import { listDenaliTemplateStorageFieldPaths } from "@repo/denali-domain";

import {
  groupTemplateBuilderFieldPaths,
  resolveModernTemplateBuilderFieldPaths,
} from "./tour-wizard-template-section-groups";

test("groupTemplateBuilderFieldPaths partitions all template storage paths", () => {
  const fieldPaths = builderFieldPaths();
  assert.ok(fieldPaths.length > 0);

  const sections = groupTemplateBuilderFieldPaths(fieldPaths);
  const grouped = sections.flatMap((section) => section.paths);

  assert.equal(grouped.length, fieldPaths.length);
  assert.deepEqual([...grouped].sort(), [...fieldPaths].sort());
});

function builderFieldPaths(): readonly string[] {
  return resolveModernTemplateBuilderFieldPaths(listDenaliTemplateStorageFieldPaths());
}

test("groupTemplateBuilderFieldPaths exposes five semantic cards", () => {
  const fieldPaths = builderFieldPaths();
  const sections = groupTemplateBuilderFieldPaths(fieldPaths);

  assert.equal(sections.length, 5);
  assert.deepEqual(
    sections.map((section) => section.id),
    ["basic", "logistics", "transport", "pricing", "marketing"],
  );

  const basic = sections.find((section) => section.id === "basic");
  const logistics = sections.find((section) => section.id === "logistics");
  const pricing = sections.find((section) => section.id === "pricing");
  assert.ok(basic?.paths.includes("duration"));
  assert.equal(basic?.paths.includes("eventVariant"), false);
  assert.ok(logistics?.paths.includes("customServiceLabels"));
  assert.ok(pricing?.paths.includes("overview.nonAttendanceDetails"));
  assert.ok(pricing?.paths.includes("participants.minRequiredPeaks"));
});

test("resolveModernTemplateBuilderFieldPaths excludes ghost overlay paths", () => {
  const base = listDenaliTemplateStorageFieldPaths();
  const withGhosts = [
    ...base,
    "startPointLocationText",
    "transport.seatPreference",
    "pricing.paymentMode",
    "transport.transportNotes",
    "publishStatus",
  ];
  const filtered = resolveModernTemplateBuilderFieldPaths(withGhosts);
  assert.equal(filtered.length, base.length - 1);
  assert.equal(filtered.includes("eventVariant"), false);
  for (const ghost of [
    "startPointLocationText",
    "transport.seatPreference",
    "pricing.paymentMode",
    "transport.transportNotes",
    "publishStatus",
  ]) {
    assert.equal(filtered.includes(ghost), false, ghost);
  }
});
