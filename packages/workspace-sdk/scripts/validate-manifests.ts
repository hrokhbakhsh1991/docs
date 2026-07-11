#!/usr/bin/env node
/**
 * CI guard — validates workspace.manifest.json under each packages/workspaces folder.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateWorkspaceManifestRecord } from "../src/manifest.schema.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_WORKSPACES_DIR = path.resolve(SDK_ROOT, "../workspaces");

function resolveWorkspacesDir(): string {
  const fromEnv = process.env.WORKSPACES_DIR?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return path.resolve(fromEnv);
  }
  return DEFAULT_WORKSPACES_DIR;
}

function discoverManifestFiles(workspacesDir: string): string[] {
  if (!fs.existsSync(workspacesDir)) {
    throw new Error(`WORKSPACE_MANIFEST_DIR_MISSING:${workspacesDir}`);
  }

  const manifestPaths: string[] = [];

  for (const entry of fs.readdirSync(workspacesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = path.join(workspacesDir, entry.name, "workspace.manifest.json");
    if (fs.existsSync(manifestPath)) {
      manifestPaths.push(manifestPath);
    }
  }

  if (manifestPaths.length === 0) {
    throw new Error(`WORKSPACE_MANIFEST_DISCOVERY_EMPTY:${workspacesDir}`);
  }

  return manifestPaths.sort((a, b) => a.localeCompare(b));
}

function validateManifestFile(manifestPath: string): string[] {
  const directoryName = path.basename(path.dirname(manifestPath));
  let raw: unknown;

  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${manifestPath}: invalid JSON: ${message}`];
  }

  const result = validateWorkspaceManifestRecord(raw, manifestPath);
  if (!result.ok) {
    return [...result.errors];
  }

  if (result.manifest.id !== directoryName) {
    return [
      `${manifestPath}: id "${result.manifest.id}" must match parent directory "${directoryName}"`,
    ];
  }

  return [];
}

export function runValidateWorkspaceManifests(
  workspacesDir: string = resolveWorkspacesDir(),
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const manifestPath of discoverManifestFiles(workspacesDir)) {
    errors.push(...validateManifestFile(manifestPath));
  }

  return { ok: errors.length === 0, errors };
}

function main(): void {
  const workspacesDir = resolveWorkspacesDir();
  const { ok, errors } = runValidateWorkspaceManifests(workspacesDir);

  if (!ok) {
    console.error(`validate-manifests: FAIL (${errors.length} error(s))`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const count = discoverManifestFiles(workspacesDir).length;
  console.log(`validate-manifests: PASS (${count} manifest(s) under ${workspacesDir})`);
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) {
  main();
}
