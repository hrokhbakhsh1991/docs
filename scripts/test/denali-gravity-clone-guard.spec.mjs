import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("DG-6 clone ratchet passes for audited workspace shapes", () => {
  const result = spawnSync("node", ["scripts/guards/guard-denali-gravity-clones.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /harbor adapters=12\/15/);
  assert.match(result.stdout, /harbor\/guest-club product overlap=0/);
  assert.match(result.stdout, /urban unclassified=0, infrastructure=4, thin-adapter=8, domain=3/);
});

test("DG-6 clone ratchet rejects a Harbor Denali-parallel product stem", () => {
  const root = mkdtempSync(join(tmpdir(), "dg-clone-negative-"));
  try {
    for (const id of ["denali", "harbor", "guest-club", "urban"]) {
      mkdirSync(join(root, id, "src", "http"), { recursive: true });
    }
    writeFileSync(join(root, "denali", "src", "http", "catalog.service.ts"), "export {};\n");
    writeFileSync(join(root, "harbor", "src", "http", "catalog.service.ts"), "export {};\n");

    const result = spawnSync("node", ["scripts/guards/guard-denali-gravity-clones.mjs"], {
      encoding: "utf8",
      env: { ...process.env, DENALI_GRAVITY_WORKSPACES_ROOT: root },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /harbor: Denali-parallel product stems: catalog\.service\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
