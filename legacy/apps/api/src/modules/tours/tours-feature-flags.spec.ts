import assert from "node:assert/strict";
import test from "node:test";

import { shouldRefreshFormProfileSnapshotOnPatch } from "./tours-feature-flags";

function clearEnv(): void {
  delete process.env.TOURS_REFRESH_FORM_PROFILE_SNAPSHOT_ON_PATCH;
}

test("shouldRefreshFormProfileSnapshotOnPatch: default is OFF when no env var is set", () => {
  clearEnv();
  assert.equal(shouldRefreshFormProfileSnapshotOnPatch(), false);
});

test("shouldRefreshFormProfileSnapshotOnPatch: '1' / 'true' / 'yes' / 'on' enable", () => {
  for (const raw of ["1", "true", "TRUE", "  yes  ", "On"]) {
    clearEnv();
    process.env.TOURS_REFRESH_FORM_PROFILE_SNAPSHOT_ON_PATCH = raw;
    try {
      assert.equal(
        shouldRefreshFormProfileSnapshotOnPatch(),
        true,
        `raw=${JSON.stringify(raw)} should enable`,
      );
    } finally {
      clearEnv();
    }
  }
});

test("shouldRefreshFormProfileSnapshotOnPatch: falsy / nonsense values stay OFF", () => {
  for (const raw of ["", "0", "false", "off", "no", "maybe"]) {
    clearEnv();
    process.env.TOURS_REFRESH_FORM_PROFILE_SNAPSHOT_ON_PATCH = raw;
    try {
      assert.equal(
        shouldRefreshFormProfileSnapshotOnPatch(),
        false,
        `raw=${JSON.stringify(raw)} should stay OFF`,
      );
    } finally {
      clearEnv();
    }
  }
});
