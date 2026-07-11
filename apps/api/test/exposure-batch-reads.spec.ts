/**
 * Exposure batch read guards — Phase 5d static checks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SURFACES_SERVICE = path.join(REPO_ROOT, "src/exposure/workspace-exposure-surfaces.service.ts");
const CONTROL_PLANE = path.join(REPO_ROOT, "src/exposure/exposure-control-plane.service.ts");
const PRISMA_INTENT = path.join(REPO_ROOT, "src/exposure/prisma-exposure-intent.repository.ts");

describe("exposure-batch-reads.spec.ts", () => {
  it("EXP-BATCH-01 getWorkspaceExposureSurfaces uses findForContexts", () => {
    const source = fs.readFileSync(SURFACES_SERVICE, "utf8");
    const body = source.match(/export async function getWorkspaceExposureSurfaces\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /findForContexts/);
    assert.doesNotMatch(body, /for\s*\([\s\S]*findForContext/);
  });

  it("EXP-BATCH-02 buildConnectionContextsFromPrefetch uses prefetched maps (no await in loop)", () => {
    const source = fs.readFileSync(CONTROL_PLANE, "utf8");
    const body = source.match(
      /function buildConnectionContextsFromPrefetch\([\s\S]*?\n  return contexts;\n\}/
    )?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /legacyIntentLookup/);
    assert.match(body, /profileById/);
    assert.doesNotMatch(body, /\bawait\b/);
  });

  it("EXP-BATCH-04 getWorkspaceExposureControlPlane batches connection intents and profiles", () => {
    const source = fs.readFileSync(CONTROL_PLANE, "utf8");
    const body = source.match(
      /export async function getWorkspaceExposureControlPlane\([\s\S]*?\n\}/
    )?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /listForConnectionScopes/);
    assert.match(body, /ensureSeededProfiles/);
    assert.match(body, /buildConnectionContextsFromPrefetch/);
    assert.doesNotMatch(body, /Promise\.all\([\s\S]*?buildConnectionContexts/);
  });

  it("EXP-BATCH-03 prisma exposure intent repo implements findForContexts", () => {
    const source = fs.readFileSync(PRISMA_INTENT, "utf8");
    assert.match(source, /async findForContexts/);
    assert.match(source, /findMany\([\s\S]*OR:/);
  });
});
