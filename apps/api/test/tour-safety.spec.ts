/**
 * Tour list projection + bounded page load guards (AP15 Faz 3).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_TOUR_REPO = path.join(REPO_ROOT, "src", "storage", "prisma-tour.repository.ts");
const LIST_TOURS_OPERATOR = path.join(REPO_ROOT, "src", "tours", "list-tours-operator.ts");
const TOUR_ADAPTER = path.join(REPO_ROOT, "src", "db", "tour-storage.adapter.ts");

describe("tour-safety.spec.ts", () => {
  it("TR-SAFE-01 prisma listByTenantPage uses TOUR_LIST_PAGE_SELECT and take", () => {
    const source = fs.readFileSync(PRISMA_TOUR_REPO, "utf8");
    const methodBody = source.match(/async listByTenantPage\([\s\S]*?\n  \}/)?.[0];
    assert.ok(methodBody !== undefined, "listByTenantPage must exist");
    assert.match(methodBody, /withTenantRls\s*\(/);
    assert.match(methodBody, /select:\s*TOUR_LIST_PAGE_SELECT/);
    assert.match(methodBody, /take:\s*input\.limit\s*\+\s*1/);
  });

  it("TR-SAFE-02 listToursOperator uses listOperatorToursPage not materialize-all", () => {
    const source = fs.readFileSync(LIST_TOURS_OPERATOR, "utf8");
    assert.match(source, /listOperatorToursPage\s*\(/);
    assert.doesNotMatch(source, /loadAllTourRecordsViaListPage\s*\(/);
    assert.doesNotMatch(source, /\.findMany\s*\(/);
  });

  it("TR-SAFE-04 prisma listOperatorToursPage uses OPERATOR_TOUR_LIST_SELECT and take", () => {
    const source = fs.readFileSync(PRISMA_TOUR_REPO, "utf8");
    const methodBody = source.match(/async listOperatorToursPage\([\s\S]*?\n  \}/)?.[0];
    assert.ok(methodBody !== undefined, "listOperatorToursPage must exist");
    assert.match(methodBody, /select:\s*OPERATOR_TOUR_LIST_SELECT/);
    assert.match(methodBody, /take:\s*input\.query\.limit/);
  });

  it("TR-SAFE-03 tour adapter findMany uses bounded listByTenantPage chunks", () => {
    const source = fs.readFileSync(TOUR_ADAPTER, "utf8");
    const methodBody = source.match(/async findMany\([\s\S]*?\n  \}/)?.[0];
    assert.ok(methodBody !== undefined, "findMany must exist");
    assert.match(methodBody, /listByTenantPage\s*\(/);
    assert.match(methodBody, /TOUR_LIST_PAGE_CHUNK_SIZE/);
    assert.doesNotMatch(methodBody, /listByTenant\s*\(/);
  });
});
