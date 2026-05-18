import assert from "node:assert/strict";
import test from "node:test";

import { parseWorkspaceTenantLabelFromHost } from "./parse-workspace-tenant-label";

const RESERVED = new Set(["www", "api", "app"]);

test("parseWorkspaceTenantLabelFromHost: label under root", () => {
  assert.deepEqual(
    parseWorkspaceTenantLabelFromHost("ws1-rbac.localhost", "localhost", RESERVED),
    { kind: "label", label: "ws1-rbac" },
  );
});

test("parseWorkspaceTenantLabelFromHost: outside_workspace blocks suffix tricks", () => {
  assert.equal(
    parseWorkspaceTenantLabelFromHost("ws1-rbac.evil.com", "localhost", RESERVED).kind,
    "outside_workspace",
  );
});

test("parseWorkspaceTenantLabelFromHost: apex", () => {
  assert.equal(
    parseWorkspaceTenantLabelFromHost("localhost", "localhost", RESERVED).kind,
    "apex",
  );
});

test("parseWorkspaceTenantLabelFromHost: reserved", () => {
  assert.deepEqual(
    parseWorkspaceTenantLabelFromHost("www.localhost", "localhost", RESERVED),
    { kind: "reserved", label: "www" },
  );
});

test("parseWorkspaceTenantLabelFromHost: denali is a tenant label (not globally reserved)", () => {
  assert.deepEqual(
    parseWorkspaceTenantLabelFromHost("denali.localhost", "localhost", RESERVED),
    { kind: "label", label: "denali" },
  );
});
