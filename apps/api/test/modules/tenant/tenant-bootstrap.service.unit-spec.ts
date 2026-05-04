import assert from "node:assert/strict";
import test from "node:test";
import { TenantBootstrapService } from "../../../src/modules/tenant/tenant-bootstrap.service";

test("resolveTenantFromTourId returns uuid when DB returns a row", async () => {
  const tid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const dataSource = {
    async query() {
      return [{ resolve_tour_tenant_for_public_flow: tid }];
    }
  };

  const service = new TenantBootstrapService(dataSource as never);
  const result = await service.resolveTenantFromTourId(
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  );
  assert.equal(result, tid);
});

test("resolveTenantFromTourId returns null when function yields SQL NULL", async () => {
  const dataSource = {
    async query() {
      return [{ resolve_tour_tenant_for_public_flow: null }];
    }
  };

  const service = new TenantBootstrapService(dataSource as never);
  const result = await service.resolveTenantFromTourId(
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  );
  assert.equal(result, null);
});

test("resolveTenantFromTourId returns null when no rows", async () => {
  const dataSource = {
    async query() {
      return [];
    }
  };

  const service = new TenantBootstrapService(dataSource as never);
  const result = await service.resolveTenantFromTourId(
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  );
  assert.equal(result, null);
});
