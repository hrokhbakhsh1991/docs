import assert from "node:assert/strict";
import test from "node:test";

import { parseWorkspaceTenantLabelFromHost } from "@repo/tenant-host";

import {
  TenantResolutionError,
  isBareApexHost,
  isValidWorkspaceSubdomainLabel,
  resolveBffTenantContext,
  resolveRuntimeTenantContextFromTrustedHeaders,
  resolveTenantSlugFromHost,
} from "./runtime-tenant-context";

function req(host: string, extra?: HeadersInit): Request {
  return new Request("http://localhost", {
    headers: { host, ...extra },
  });
}

test("resolveBffTenantContext from workspace host", () => {
  const ctx = resolveBffTenantContext(req("ws1-rbac.localhost:3000"));
  assert.equal(ctx.tenantSlug, "ws1-rbac");
});

test("resolveBffTenantContext reads tenant id from header", () => {
  const ctx = resolveBffTenantContext(
    req("ws2-rbac.localhost:3000", { "x-tenant-id": "15467987-98da-458b-89e5-17e444706ec0" }),
  );
  assert.equal(ctx.tenantSlug, "ws2-rbac");
  assert.equal(ctx.tenantId, "15467987-98da-458b-89e5-17e444706ec0");
});

test("resolveBffTenantContext ignores spoofed x-tenant-slug", () => {
  const ctx = resolveBffTenantContext(
    req("ws1-rbac.localhost:3000", { "x-tenant-slug": "evil-tenant" }),
  );
  assert.equal(ctx.tenantSlug, "ws1-rbac");
});

test("resolveBffTenantContext rejects reserved slug host", () => {
  assert.throws(
    () => resolveBffTenantContext(req("app.localhost:3000")),
    (e: unknown) => e instanceof TenantResolutionError,
  );
});

test("resolveTenantSlugFromHost rejects host outside workspace root", () => {
  assert.equal(resolveTenantSlugFromHost("ws1-rbac.evil.com:3000"), null);
});

test("isValidWorkspaceSubdomainLabel rejects underscore labels", () => {
  assert.equal(isValidWorkspaceSubdomainLabel("ws1_rbac"), false);
  assert.equal(isValidWorkspaceSubdomainLabel("ws1-rbac"), true);
});

test("resolveTenantSlugFromHost returns null for invalid label shape", () => {
  assert.equal(resolveTenantSlugFromHost("bad_label.localhost:3000"), null);
});

test("parseWorkspaceTenantLabelFromHost keeps typo labels for middleware API probe", () => {
  const outcome = parseWorkspaceTenantLabelFromHost(
    "ws1-rbklkljac.localhost",
    "localhost",
    new Set(["www", "api", "app"]),
  );
  assert.equal(outcome.kind, "label");
  if (outcome.kind === "label") {
    assert.equal(outcome.label, "ws1-rbklkljac");
  }
});

test("isBareApexHost for localhost without workspace label", () => {
  assert.equal(isBareApexHost("localhost:3000"), true);
  assert.equal(isBareApexHost("127.0.0.1:3000"), true);
  assert.equal(isBareApexHost("ws1-rbac.localhost:3000"), false);
});

test("resolveRuntimeTenantContextFromTrustedHeaders prefers middleware x-tenant-slug", () => {
  const headers = new Headers({
    host: "ws1-rbac.localhost:3000",
    "x-tenant-slug": "ws1-rbac",
    "x-tenant-id": "tenant-uuid-1",
  });
  const ctx = resolveRuntimeTenantContextFromTrustedHeaders(headers);
  assert.equal(ctx.tenantSlug, "ws1-rbac");
  assert.equal(ctx.tenantId, "tenant-uuid-1");
});

test("resolveRuntimeTenantContextFromTrustedHeaders falls back to Host when slug header absent", () => {
  const headers = new Headers({ host: "ws2-rbac.localhost:3000" });
  const ctx = resolveRuntimeTenantContextFromTrustedHeaders(headers);
  assert.equal(ctx.tenantSlug, "ws2-rbac");
});

test("resolveRuntimeTenantContextFromTrustedHeaders uses injected slug even if Host label differs", () => {
  const headers = new Headers({
    host: "ws1-rbac.localhost:3000",
    "x-tenant-slug": "ws1-rbac",
  });
  const ctx = resolveRuntimeTenantContextFromTrustedHeaders(headers);
  assert.equal(ctx.tenantSlug, "ws1-rbac");
});
