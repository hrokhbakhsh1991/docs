/**
 * B2.2 — bare-IP marketing egress contract (red until GSH pluginId override lands).
 * @see B2.1 trace: bootstrap.pluginId must override resolvePluginIdFromIngressHost(host).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePortalMemberLoginUrl,
  resolvePortalMemberModuleUrl,
  resolvePortalPublicBaseUrl,
} from "../src/index";

/** B2.1 contract — optional pluginId override (third argument). */
type ResolvePortalMemberLoginUrlB2 = (
  host: string,
  returnPath?: string,
  pluginId?: string
) => string | null;

type ResolvePortalMemberModuleUrlB2 = (
  host: string,
  moduleId?: string,
  pluginId?: string
) => string | null;

const resolveLoginWithPluginId = resolvePortalMemberLoginUrl as ResolvePortalMemberLoginUrlB2;
const resolveModuleWithPluginId = resolvePortalMemberModuleUrl as ResolvePortalMemberModuleUrlB2;

const BARE_IP_HOST = "203.0.113.1:3002";
const DENALI_PLUGIN_ID = "denali";
const DENALI_MY_TRIPS_PATH = "/me/registrations";

describe("bare-ip pluginId egress — B2.2 GSH contract", () => {
  it("B2.2-GSH-01 bare-IP host + explicit denali pluginId resolves non-null portal login URL", () => {
    const loginUrl = resolveLoginWithPluginId(BARE_IP_HOST, undefined, DENALI_PLUGIN_ID);
    assert.notEqual(loginUrl, null);
    assert.match(loginUrl!, /^https?:\/\//);
    assert.match(loginUrl!, /\/login\?portalReturn=/);
  });

  it("B2.2-GSH-02 bare-IP host + explicit denali pluginId resolves canonical my-trips module URL", () => {
    const expected = `${resolvePortalPublicBaseUrl(BARE_IP_HOST)}${DENALI_MY_TRIPS_PATH}`;
    const moduleUrl = resolveModuleWithPluginId(BARE_IP_HOST, "trips", DENALI_PLUGIN_ID);
    assert.notEqual(moduleUrl, null);
    assert.notEqual(moduleUrl, "/");
    assert.equal(moduleUrl, expected);
    assert.match(moduleUrl!, /\/me\/registrations$/);
  });

  it("B2.2-GSH-03 canonical host resolution without pluginId override stays unchanged", () => {
    assert.equal(
      resolvePortalMemberLoginUrl("denali.club"),
      "http://portal.denali.club:3003/login?portalReturn=%2Fme%2Fregistrations"
    );
    assert.equal(
      resolvePortalMemberModuleUrl("denali.club", "trips"),
      "http://portal.denali.club:3003/me/registrations"
    );
    assert.equal(
      resolveModuleWithPluginId("denali.club", "trips"),
      "http://portal.denali.club:3003/me/registrations"
    );
  });

  it("B2.2-GSH-04 absent or invalid pluginId override does not emit cross-tenant member URLs", () => {
    assert.equal(resolveModuleWithPluginId(BARE_IP_HOST, "trips"), null);
    assert.equal(resolveLoginWithPluginId(BARE_IP_HOST), null);
    assert.equal(resolveModuleWithPluginId(BARE_IP_HOST, "trips", ""), null);
    assert.equal(resolveLoginWithPluginId(BARE_IP_HOST, undefined, ""), null);
    assert.equal(resolveModuleWithPluginId(BARE_IP_HOST, "trips", "starter"), null);
    assert.equal(resolveLoginWithPluginId(BARE_IP_HOST, undefined, "starter"), null);
    assert.equal(resolveModuleWithPluginId(BARE_IP_HOST, "trips", "not-a-workspace"), null);
  });
});
