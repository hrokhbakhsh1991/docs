import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("DG-6 workspace roles remain explicit and fail-closed", () => {
  const result = spawnSync("node", ["scripts/guards/guard-denali-gravity-workspace-roles.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /4 registry fixtures/);
  assert.match(result.stdout, /0 implicit guest products/);
});

test("DG-6 workspace-role ratchet rejects implicit guest certification", () => {
  const root = mkdtempSync(join(tmpdir(), "dg-role-negative-"));
  try {
    const manifests = {
      "finance-ws2": { workspaceFinance: { supported: false, registryOnly: true } },
      "finance-ws3": { workspaceFinance: { supported: false, registryOnly: true } },
      "finance-ws4": { workspaceFinance: { supported: false, registryOnly: true } },
      "finance-ws6": { workspaceFinance: { supported: false, registryOnly: true } },
      "finance-ws5": {
        workspaceFinance: { supported: true },
        guestConformance: { productionTier: "certified" },
      },
      "booking-ws2": { workspaceBooking: { supported: true } },
      "wallet-ws1": { workspaceWallet: { supported: true } },
    };
    for (const [id, value] of Object.entries(manifests)) {
      mkdirSync(join(root, id), { recursive: true });
      writeFileSync(join(root, id, "workspace.manifest.json"), `${JSON.stringify(value)}\n`);
    }

    const result = spawnSync(
      "node",
      ["scripts/guards/guard-denali-gravity-workspace-roles.mjs"],
      {
        encoding: "utf8",
        env: { ...process.env, DENALI_GRAVITY_WORKSPACES_ROOT: root },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /finance-ws5: capability proof must not become a certified guest product/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
