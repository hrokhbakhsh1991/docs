import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUARD = path.join(PKG_ROOT, "scripts/guard-boundary.mjs");

/** CW5-11 public API snapshot — coordinator-owned barrel exports. */
const EXPECTED_RUNTIME_EXPORTS = [
  "TOUR_CORE_PACKAGE_MARKER",
  "computeSpotsRemaining",
  "withSpotsRemaining",
  "atCreateCapacityStrategy",
  "resolveRegistrationCapacityDecision",
  "sumAcceptedRegistrationSeats",
  "readCapacityAtPath",
  "sumOccupyingSeatsForStatus",
  "readFiniteCapacityNumber",
  "assertWorkspaceRegistrationContactBasics",
  "assertWorkspaceTypeOrThrow",
  "createTourDepartureNotSetValidationError",
  "createTourNotPublishedValidationError",
  "loadWorkspaceTourIfPublished",
  "normalizeWorkspaceTypeKey",
  "readWorkspaceCanonicalCapacityByPath",
  "requireWorkspacePublishedTour",
  "WORKSPACE_REGISTRATION_EMAIL_PATTERN",
  "WORKSPACE_REGISTRATION_PHONE_PATTERN",
  "BOOKING_REGISTRATION_MODEL",
  "URBAN_REGISTRATION_MODEL",
  "registrationAwaitingOperatorDecision",
  "registrationOccupiesSeat",
  "registrationQueuedWithoutSeat",
  "registrationTerminalNegative",
  "registrationVoided",
  "mapPublishLabelToVisibilityBucket",
  "detectTourPublishTransition",
  "assertCanTransitionState",
  "canTransitionState",
  "isTerminalTransitionStatus",
  "listTransitionSourcesForTarget",
  "listTransitionTargetsFrom",
  "BOOKING_TRANSITION_TABLE",
  "assertCanTransitionBookingViaGenericTable",
  "canTransitionBookingViaGenericTable",
  "listBookingTransitionSourcesForTarget",
  "listBookingTransitionTargetsFrom",
  "mergeShallowCanonicalPatchData",
] as const;

describe("CW5-11 tour-core certification", () => {
  it("CW5-11-01 package.json dependencies obey DEC-CW-07", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"));
    assert.deepEqual(Object.keys(pkg.dependencies ?? {}), ["@app-tour/booking-http-contracts"]);
  });

  it("CW5-11-02 guard-boundary PASS (no forbidden imports)", () => {
    const r = spawnSync(process.execPath, [GUARD], { cwd: PKG_ROOT, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  it("CW5-11-03 public API snapshot matches coordinator barrel", async () => {
    const mod = await import("../src/index.ts");
    const exportNames = Object.keys(mod).sort();
    for (const name of EXPECTED_RUNTIME_EXPORTS) {
      assert.ok(exportNames.includes(name), `missing export ${name}`);
    }
  });

  it("CW5-11-04 forbidden dependency directions absent from src imports", () => {
    const forbidden = [
      "@app-tour/workspace-sdk",
      "@app-tour/platform-core",
      "@app-tour/finance-core",
      "@app-tour/workspace-",
    ];
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walk(p));
        else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) out.push(p);
      }
      return out;
    };
    for (const file of walk(path.join(PKG_ROOT, "src"))) {
      const src = fs.readFileSync(file, "utf8");
      for (const needle of forbidden) {
        assert.ok(!src.includes(`from "${needle}`), `${file} imports ${needle}`);
      }
    }
  });
});
