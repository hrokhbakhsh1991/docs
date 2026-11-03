import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { describe, it } from "node:test";
import { promisify } from "node:util";

import { resolveStagingAdminSmokeHost } from "../vps-deploy/resolve-staging-admin-smoke-host.mjs";

const originMap = JSON.stringify({
  version: 1,
  tenants: [
    {
      tenantId: "00000000-0000-4000-8000-000000000003",
      origins: {
        admin: "https://admin.denali.staging.test",
        marketing: "https://denali.staging.test",
        portal: "https://portal.denali.staging.test",
      },
      cookieDomain: "denali.staging.test",
      aliases: {
        admin: [
          { origin: "https://admin.denali.shenski.com", cookieDomain: "shenski.com" },
          { origin: "https://staging-admin-denali.shenski.com", cookieDomain: "shenski.com" },
        ],
      },
    },
    {
      tenantId: "f0ed9e65-2638-4351-847d-724f87ebbfce",
      origins: {
        admin: "https://admin.qa2.staging.test",
        marketing: "https://qa2.staging.test",
        portal: "https://portal.qa2.staging.test",
      },
      cookieDomain: "qa2.staging.test",
      aliases: {
        admin: [{ origin: "https://staging-admin-qa2.shenski.com", cookieDomain: "shenski.com" }],
      },
    },
  ],
});

const resolveForFixture = (map, hosts) =>
  resolveStagingAdminSmokeHost(map, hosts, "https://denali.staging.test");
const run = promisify(execFile);

describe("resolve-staging-admin-smoke-host", () => {
  it("uses the configured public marketing origin after Profile B canonicalizes the tenant", () => {
    const synced = JSON.parse(originMap);
    const tenant = synced.tenants[0];
    tenant.origins.marketing = "https://staging-denali.shenski.com";
    tenant.aliases.marketing = [{ origin: "https://denali.staging.test", cookieDomain: null }];
    assert.equal(
      resolveStagingAdminSmokeHost(
        JSON.stringify(synced),
        "staging-admin-denali.shenski.com",
        "https://staging-denali.shenski.com"
      ),
      "staging-admin-denali.shenski.com"
    );
  });

  it("accepts a configured marketing alias without crossing tenants", () => {
    const map = JSON.parse(originMap);
    map.tenants[0].aliases.marketing = [
      { origin: "https://staging-denali.shenski.com", cookieDomain: "shenski.com" },
    ];
    assert.equal(
      resolveStagingAdminSmokeHost(
        JSON.stringify(map),
        "staging-admin-denali.shenski.com",
        "https://staging-denali.shenski.com"
      ),
      "staging-admin-denali.shenski.com"
    );
    assert.throws(
      () =>
        resolveStagingAdminSmokeHost(
          JSON.stringify(map),
          "staging-admin-qa2.shenski.com",
          "https://staging-denali.shenski.com"
        ),
      /not explicitly mapped/
    );
  });

  it("rejects missing, invalid, unmatched, or ambiguous marketing origins", () => {
    for (const origin of [
      "",
      "http://staging-denali.shenski.com",
      "https://example.test/path",
      "https://example.test/a/..",
      "https://staging-denali.shenski.com:443",
      "https://staging-denali.shenski.com./",
    ]) {
      assert.throws(
        () => resolveStagingAdminSmokeHost(originMap, "staging-admin-denali.shenski.com", origin),
        /valid HTTPS origin/
      );
    }
    assert.throws(
      () =>
        resolveStagingAdminSmokeHost(
          originMap,
          "staging-admin-denali.shenski.com",
          "https://unknown.example"
        ),
      /exactly one tenant/
    );
    const duplicate = JSON.parse(originMap);
    duplicate.tenants[1].aliases.marketing = [
      { origin: "https://denali.staging.test", cookieDomain: null },
    ];
    assert.throws(
      () => resolveForFixture(JSON.stringify(duplicate), "staging-admin-denali.shenski.com"),
      /exactly one tenant/
    );
  });

  it("runs the four-process smoke with synchronized public origins and the correct admin host", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".staging-smoke-test-"));
    const requests = [];
    const servers = [];
    try {
      for (const surface of ["api", "web", "marketing", "portal"]) {
        const server = createServer((req, res) => {
          requests.push({ surface, host: req.headers.host });
          const validHost =
            surface !== "web" || req.headers.host === "staging-admin-denali.shenski.com";
          res.writeHead(validHost ? 200 : 421).end("ok");
        });
        servers.push(server);
        await new Promise((resolve, reject) =>
          server.once("error", reject).listen(0, "127.0.0.1", resolve)
        );
      }
      const map = JSON.parse(originMap);
      for (const tenant of map.tenants) delete tenant.aliases;
      const port = (index) => servers[index].address().port;
      await Promise.all([
        writeFile(
          join(dir, "api.env"),
          `PORT=${port(0)}\nTENANT_SURFACE_ORIGIN_MAP_JSON='${JSON.stringify(map)}'\n`
        ),
        writeFile(join(dir, "web.env"), `PORT=${port(1)}\n`),
        writeFile(join(dir, "marketing.env"), `PORT=${port(2)}\n`),
        writeFile(join(dir, "portal.env"), `PORT=${port(3)}\n`),
      ]);
      const env = {
        ...process.env,
        ENV_DIR: dir,
        STAGING_PUBLIC_ROOT_DOMAIN: "shenski.com",
        STAGING_PUBLIC_MARKETING_BASE_URL: "https://staging-denali.shenski.com",
        STAGING_PUBLIC_PORTAL_BASE_URL: "https://staging-portal-denali.shenski.com",
        STAGING_ADMIN_HOST: "staging-admin-denali.shenski.com",
        SMOKE_ATTEMPTS: "1",
        SMOKE_SLEEP_SEC: "0",
        UNIT_PREFIX: "session-test",
      };
      delete env.STAGING_TENANT_SURFACE_ORIGIN_MAP_JSON;
      await run("bash", ["scripts/vps-deploy/sync-staging-profile-b-public-urls.sh"], {
        env,
        timeout: 10000,
      });
      const result = await run("bash", ["scripts/vps-deploy/smoke-four-process.sh"], {
        env,
        timeout: 10000,
      });
      assert.match(result.stdout, /SMOKE_FOUR_PROCESS_OK/);
      assert.deepEqual(
        requests.map((request) => request.surface),
        ["api", "web", "marketing", "portal"]
      );
      assert.equal(
        requests.find((request) => request.surface === "web")?.host,
        "staging-admin-denali.shenski.com"
      );
      await writeFile(
        join(dir, "web.env"),
        `PORT=${port(1)}\nOPERATOR_ADMIN_ROOT_HOSTS=staging-admin-qa2.shenski.com\n`
      );
      await assert.rejects(
        run("bash", ["scripts/vps-deploy/smoke-four-process.sh"], { env, timeout: 10000 }),
        (error) => /not explicitly mapped/.test(error.stderr)
      );
      await writeFile(join(dir, "marketing.env"), `PORT=${port(2)}\n`);
      await assert.rejects(
        run("bash", ["scripts/vps-deploy/smoke-four-process.sh"], { env, timeout: 10000 }),
        (error) => /MARKETING_PUBLIC_BASE_URL must be a valid HTTPS origin/.test(error.stderr)
      );
      assert.equal(requests.length, 4, "invalid configuration must fail before sending probes");
    } finally {
      await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("selects the configured public admin alias mapped to tenant A, not its private origin", () => {
    assert.equal(
      resolveForFixture(originMap, "staging-admin-denali.shenski.com"),
      "staging-admin-denali.shenski.com"
    );
  });

  it("accepts the canonical admin origin only when it is the configured ingress host", () => {
    assert.equal(
      resolveForFixture(originMap, "admin.denali.staging.test"),
      "admin.denali.staging.test"
    );
  });

  it("rejects an unconfigured, marketing, or tenant-B host", () => {
    for (const host of [
      "unknown.shenski.com",
      "staging-denali.shenski.com",
      "staging-admin-qa2.shenski.com",
    ]) {
      assert.throws(
        () => resolveForFixture(originMap, host),
        /not explicitly mapped to the selected tenant's admin surface/
      );
    }
  });

  it("fails closed when map JSON or the configured admin host is missing", () => {
    assert.throws(
      () => resolveForFixture("{invalid", "staging-admin-denali.shenski.com"),
      /must contain valid JSON/
    );
    assert.throws(() => resolveForFixture(originMap, ""), /must be configured/);
  });

  it("rejects configured hosts containing ports or URL components", () => {
    for (const host of [
      "staging-admin-denali.shenski.com:443",
      "staging-admin-denali.shenski.com/path",
      "staging-admin-denali.shenski.com?tenant=b",
      "staging-admin-denali.shenski.com#fragment",
    ]) {
      assert.throws(() => resolveForFixture(originMap, host), /hostnames without ports or paths/);
    }
  });
});
