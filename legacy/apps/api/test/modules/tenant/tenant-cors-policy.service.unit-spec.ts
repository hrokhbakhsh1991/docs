import assert from "node:assert/strict";
import test from "node:test";

import { TenantCorsPolicyService } from "../../../src/modules/tenant/tenant-cors-policy.service";

function buildPolicy(input: {
  explicitWhitelist?: boolean;
  devDefault?: boolean;
  platformSuborigin?: boolean;
  allowTenantSuborigins?: boolean;
  registeredWebOrigin?: boolean;
}) {
  const config = {
    isCorsOriginAllowedExplicitWhitelist: () => input.explicitWhitelist ?? false,
    isCorsOriginAllowedDevelopmentDefault: () => input.devDefault ?? false,
    isCorsPlatformSuboriginAllowed: () => input.platformSuborigin ?? false,
    getCorsAllowTenantSuborigins: () => input.allowTenantSuborigins ?? true,
  };
  const ingressRegistry = {
    isRegisteredWebOrigin: async () => input.registeredWebOrigin ?? false,
  };

  return new TenantCorsPolicyService(config as never, ingressRegistry as never);
}

test("TenantCorsPolicyService: undefined origin allowed", async () => {
  const policy = buildPolicy({});
  assert.equal(await policy.isOriginAllowed(undefined), true);
});

test("TenantCorsPolicyService: tier 1 explicit whitelist short-circuits registry", async () => {
  let registryCalls = 0;
  const config = {
    isCorsOriginAllowedExplicitWhitelist: () => true,
    isCorsOriginAllowedDevelopmentDefault: () => false,
    isCorsPlatformSuboriginAllowed: () => false,
    getCorsAllowTenantSuborigins: () => true,
  };
  const ingressRegistry = {
    isRegisteredWebOrigin: async () => {
      registryCalls += 1;
      return true;
    },
  };
  const policy = new TenantCorsPolicyService(config as never, ingressRegistry as never);

  assert.equal(await policy.isOriginAllowed("https://explicit.example"), true);
  assert.equal(registryCalls, 0);
});

test("TenantCorsPolicyService: tier 3a platform suffix allowed without registry", async () => {
  const policy = buildPolicy({ platformSuborigin: true });
  assert.equal(await policy.isOriginAllowed("https://acme.app.example.com"), true);
});

test("TenantCorsPolicyService: tier 3b custom origin uses registry lookup", async () => {
  const policy = buildPolicy({ registeredWebOrigin: true });
  assert.equal(await policy.isOriginAllowed("https://bookings.customer.com"), true);
});

test("TenantCorsPolicyService: denies unknown custom origin when registry rejects", async () => {
  const policy = buildPolicy({ registeredWebOrigin: false });
  assert.equal(await policy.isOriginAllowed("https://unknown.customer.com"), false);
});

test("TenantCorsPolicyService: skips registry when tenant suborigins disabled", async () => {
  let registryCalls = 0;
  const config = {
    isCorsOriginAllowedExplicitWhitelist: () => false,
    isCorsOriginAllowedDevelopmentDefault: () => false,
    isCorsPlatformSuboriginAllowed: () => false,
    getCorsAllowTenantSuborigins: () => false,
  };
  const ingressRegistry = {
    isRegisteredWebOrigin: async () => {
      registryCalls += 1;
      return true;
    },
  };
  const policy = new TenantCorsPolicyService(config as never, ingressRegistry as never);

  assert.equal(await policy.isOriginAllowed("https://bookings.customer.com"), false);
  assert.equal(registryCalls, 0);
});
