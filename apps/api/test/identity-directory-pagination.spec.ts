/**
 * Identity directory list — avatar batch row build (avatar-only scope).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USERS_SERVICE = path.join(REPO_ROOT, "src/identity/users.service.ts");

describe("identity-directory-pagination.spec.ts", () => {
  it("ID-DIR-04 listUsersDirectory builds rows via directoryRowsFromPairs", () => {
    const source = fs.readFileSync(USERS_SERVICE, "utf8");
    const body = source.match(/export async function listUsersDirectory\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /directoryRowsFromPairs\(pairs\)/);
  });
});
