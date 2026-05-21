import assert from "node:assert/strict";
import test from "node:test";
import { requestContextStorage } from "./request-context";
import { RequestContextService } from "./request-context.service";

test("tenant context is immutable once set within a request", () => {
  const service = new RequestContextService();
  requestContextStorage.run(
    {
      requestId: "req-1",
      tenantId: "11111111-1111-4111-8111-111111111111"
    },
    () => {
      service.setTenantId("11111111-1111-4111-8111-111111111111");
      assert.throws(
        () => service.setTenantId("22222222-2222-4222-8222-222222222222"),
        /TENANT_CONTEXT_INVALID/
      );
    }
  );
});

test("JWT override may replace host-frozen tenant on cross-host auth routes", () => {
  const service = new RequestContextService();
  requestContextStorage.run(
    {
      requestId: "req-3"
    },
    () => {
      service.setHostTenantId("33333333-3333-4333-8333-333333333333");
      service.enableJwtTenantOverrideHost();
      service.setTenantId("11111111-1111-4111-8111-111111111111");
      assert.equal(service.getTenantId(), "11111111-1111-4111-8111-111111111111");
    }
  );
});

test("host-derived tenant freezes request tenant context", () => {
  const service = new RequestContextService();
  requestContextStorage.run(
    {
      requestId: "req-2"
    },
    () => {
      service.setHostTenantId("33333333-3333-4333-8333-333333333333");
      assert.equal(
        service.getTenantId(),
        "33333333-3333-4333-8333-333333333333"
      );
      assert.throws(
        () => service.setTenantId("44444444-4444-4444-8444-444444444444"),
        /TENANT_CONTEXT_INVALID/
      );
    }
  );
});
