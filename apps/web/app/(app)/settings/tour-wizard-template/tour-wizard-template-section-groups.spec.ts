import assert from "node:assert/strict";
import test from "node:test";

import {
  DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS,
  listDenaliSettingsOverlayStoragePaths,
} from "@repo/denali-domain";

import {
  groupTemplateBuilderFieldPaths,
  resolveModernTemplateBuilderFieldPaths,
} from "./tour-wizard-template-section-groups";

test("groupTemplateBuilderFieldPaths partitions all Layer C paths", () => {
  const fieldPaths = resolveModernTemplateBuilderFieldPaths(
    DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS,
  );
  assert.equal(fieldPaths.length, 52);
  assert.equal(listDenaliSettingsOverlayStoragePaths().length, 52);

  const sections = groupTemplateBuilderFieldPaths(fieldPaths);
  const grouped = sections.flatMap((section) => section.paths);

  assert.equal(grouped.length, 52);
  assert.deepEqual([...grouped].sort(), [...fieldPaths].sort());
});

test("groupTemplateBuilderFieldPaths exposes five semantic cards", () => {
  const fieldPaths = resolveModernTemplateBuilderFieldPaths(
    DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS,
  );
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
  assert.ok(logistics?.paths.includes("customServiceLabels"));
  assert.ok(pricing?.paths.includes("overview.nonAttendanceDetails"));
  assert.ok(pricing?.paths.includes("participants.minRequiredPeaks"));
});

test("resolveModernTemplateBuilderFieldPaths excludes ghost overlay paths", () => {
  const withGhosts = [
    ...DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS,
    "startPointLocationText",
    "transport.seatPreference",
    "pricing.paymentMode",
    "transport.transportNotes",
    "publishStatus",
  ];
  const filtered = resolveModernTemplateBuilderFieldPaths(withGhosts);
  assert.equal(filtered.length, 52);
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
