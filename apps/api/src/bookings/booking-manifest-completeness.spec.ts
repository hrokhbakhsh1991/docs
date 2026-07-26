/**
 * Phase B1.8 — Generated Booking bindings match workspace.manifest.json (SoT).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isBookingSupportedWorkspace,
  WORKSPACE_BOOKING_BINDINGS,
} from "./workspace-booking-bindings.generated.ts";
import {
  resolveBookingWorkspaceDependencies,
  WORKSPACE_BOOKING_DEPENDENCY_BINDINGS,
} from "./booking-dependency-registry.ts";
import { WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS } from "./workspace-booking-event-reaction-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, "../../../..");
const WORKSPACES_DIR = join(REPO_ROOT, "packages/workspaces");
const WEB_OPS_BINDER = join(
  REPO_ROOT,
  "apps/web/src/bootstrap/workspace-booking-ops-bindings.generated.ts"
);

type ModuleExport = { readonly module?: string; readonly export?: string };
type OpsManifest = {
  readonly module?: string;
  readonly defaultExport?: string;
  readonly resolveFromThemeExport?: string;
};

type BookingManifestSlice = {
  readonly id: string;
  readonly workspaceTypes: readonly string[];
  readonly workspaceBooking?: {
    readonly supported?: boolean;
    readonly registryOnly?: boolean;
    readonly defaultModuleEnabledWhenUnset?: boolean;
    readonly publicBooking?: ModuleExport;
    readonly capacityPolicy?: ModuleExport;
    readonly validationPolicy?: ModuleExport;
    readonly eventReaction?: ModuleExport & { readonly requiresHostIo?: boolean };
    readonly opsManifest?: OpsManifest;
  };
};

function loadBookingManifests(): BookingManifestSlice[] {
  const out: BookingManifestSlice[] = [];
  for (const ent of readdirSync(WORKSPACES_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const manifestPath = join(WORKSPACES_DIR, ent.name, "workspace.manifest.json");
    if (!existsSync(manifestPath)) continue;
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as BookingManifestSlice;
    if (parsed.workspaceBooking !== undefined) {
      out.push(parsed);
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function readGenerated(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

describe("BK-B1.8 booking manifest completeness", () => {
  it("every workspaceBooking.supported manifest appears in gate + dependency bindings", () => {
    const manifests = loadBookingManifests();
    assert.ok(manifests.length >= 2, "expected Denali + booking-ws2");

    const supported = manifests.filter((m) => m.workspaceBooking?.supported === true);
    assert.equal(supported.length, WORKSPACE_BOOKING_BINDINGS.length);

    const expectedTypes = supported
      .flatMap((m) => m.workspaceTypes.map((wt) => wt.trim().toLowerCase()))
      .sort();

    for (const m of supported) {
      for (const wt of m.workspaceTypes) {
        assert.equal(
          isBookingSupportedWorkspace(wt),
          true,
          `${m.id} workspaceType ${wt} should be booking-supported`
        );
        assert.ok(
          wt.trim().toLowerCase() in WORKSPACE_BOOKING_DEPENDENCY_BINDINGS,
          `${m.id} workspaceType ${wt} should have dependency bindings`
        );
        assert.equal(resolveBookingWorkspaceDependencies(wt).workspaceType, wt.trim().toLowerCase());
      }
    }

    assert.deepEqual(Object.keys(WORKSPACE_BOOKING_DEPENDENCY_BINDINGS).sort(), expectedTypes);
  });

  it("generated dependency / eventReaction artifacts contain manifest export names; web ops binder deleted", () => {
    const depsSrc = readGenerated("workspace-booking-dependency-bindings.generated.ts");
    const reactionSrc = readGenerated("workspace-booking-event-reaction-bindings.generated.ts");
    const gateSrc = readGenerated("workspace-booking-bindings.generated.ts");

    assert.match(depsSrc, /AUTO-GENERATED/);
    assert.match(reactionSrc, /AUTO-GENERATED/);
    assert.match(gateSrc, /AUTO-GENERATED/);
    assert.equal(
      existsSync(WEB_OPS_BINDER),
      false,
      "Phase 4bf — booking-ops web binder retired; capabilities.bookingOps owns hub resolve"
    );

    for (const m of loadBookingManifests()) {
      const booking = m.workspaceBooking;
      if (booking === undefined) continue;

      for (const field of ["publicBooking", "capacityPolicy", "validationPolicy"] as const) {
        const block = booking[field];
        if (block?.export !== undefined) {
          assert.match(
            depsSrc,
            new RegExp(block.export.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
            `${m.id}.${field}.export missing from dependency bindings`
          );
        }
      }
      assert.doesNotMatch(
        depsSrc,
        /OpsCapability|createOpsCapability|opsCapability/,
        "dependency bag must not carry hollow opsCapability tokens"
      );

      if (booking.eventReaction?.export !== undefined) {
        assert.match(
          reactionSrc,
          new RegExp(booking.eventReaction.export.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
          `${m.id}.eventReaction.export missing from event-reaction bindings`
        );
        for (const wt of m.workspaceTypes) {
          assert.ok(
            wt.trim().toLowerCase() in WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS,
            `${m.id} workspaceType ${wt} missing event reaction binding`
          );
        }
      }

      // Dual-SOT: packaging still declares opsManifest; runtime is capabilities.bookingOps.
      if (booking.opsManifest !== undefined) {
        const ops = booking.opsManifest;
        assert.ok(typeof ops.module === "string" && ops.module.length > 0, `${m.id} opsManifest.module`);
        assert.ok(
          typeof ops.defaultExport === "string" && ops.defaultExport.length > 0,
          `${m.id} opsManifest.defaultExport`
        );
        assert.ok(
          typeof ops.resolveFromThemeExport === "string" && ops.resolveFromThemeExport.length > 0,
          `${m.id} opsManifest.resolveFromThemeExport`
        );
        const pkgDir = join(WORKSPACES_DIR, m.id);
        const modulePathCandidates = [
          join(pkgDir, "src", `${ops.module}.ts`),
          join(pkgDir, "src", ops.module, "index.ts"),
          join(pkgDir, "src", "bookings", "ops-manifest.ts"),
        ];
        const moduleSrcPath = modulePathCandidates.find((p) => existsSync(p));
        assert.ok(moduleSrcPath, `${m.id} opsManifest module file missing`);
        const moduleSrc = readFileSync(moduleSrcPath!, "utf8");
        assert.match(
          moduleSrc,
          new RegExp(ops.defaultExport!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
          `${m.id}.opsManifest.defaultExport missing from package module`
        );
        assert.match(
          moduleSrc,
          new RegExp(ops.resolveFromThemeExport!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
          `${m.id}.opsManifest.resolveFromThemeExport missing from package module`
        );
      }
    }
  });

  it("hand-written registries have no workspace package imports", () => {
    for (const rel of [
      "booking-dependency-registry.ts",
      "booking-event-reaction-registry.ts",
    ]) {
      const src = readGenerated(rel);
      assert.doesNotMatch(src, /@app-tour\/workspace-/);
    }
  });

  it("hand-written booking sources have no adapter hand-Maps", () => {
    const forbidden = [
      /new Map\s*<[^>]*>\s*\(\s*\[\s*\[\s*["']denali["']/,
      /Record\s*<\s*string\s*,\s*[^>]+>\s*=\s*\{\s*["']denali["']\s*:/,
      /DenaliBookingPublicAdapter\s*,\s*BookingWs2PublicAdapter/,
    ];
    const files = readdirSync(here).filter(
      (name) =>
        name.endsWith(".ts") &&
        !name.endsWith(".generated.ts") &&
        !name.endsWith(".spec.ts")
    );
    for (const name of files) {
      const src = readGenerated(name);
      for (const pattern of forbidden) {
        assert.doesNotMatch(src, pattern, `${name} looks like a hand adapter Map`);
      }
      assert.doesNotMatch(src, /@app-tour\/workspace-denali\/host\/booking/);
      assert.doesNotMatch(src, /@app-tour\/workspace-booking-ws2\/host\/booking/);
    }
  });
});
