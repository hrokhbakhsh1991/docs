import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import {
  TENANT_MAX_HOST_LENGTH,
  TenantHostResolverService,
  normalizeInboundHostname,
  parseWorkspaceTenantLabelFromHost,
  resolveTenantFromHost
} from "../../../src/modules/tenant/tenant-host-resolver.service";

function mockReq(partial: Partial<Request>): Request {
  return partial as Request;
}

test("normalizeInboundHostname: accepts tenant1.example.com (lowercased)", () => {
  const r = normalizeInboundHostname("Tenant1.Example.COM");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.host, "tenant1.example.com");
  }
});

test("normalizeInboundHostname: strips port for IPv4 host", () => {
  const r = normalizeInboundHostname("acme.app.example.com:8443");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.host, "acme.app.example.com");
  }
});

test("normalizeInboundHostname: strips port for bracketed IPv6", () => {
  const r = normalizeInboundHostname("[2001:db8::1]:443");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.host, "[2001:db8::1]");
  }
});

test("normalizeInboundHostname: rejects length > TENANT_MAX_HOST_LENGTH", () => {
  const label = "a".repeat(TENANT_MAX_HOST_LENGTH);
  const r = normalizeInboundHostname(`${label}.com`);
  assert.equal(r.ok, false);
});

test("normalizeInboundHostname: rejects .. in host", () => {
  assert.equal(normalizeInboundHostname("evil..example.com").ok, false);
  assert.equal(normalizeInboundHostname("..example.com").ok, false);
});

test("normalizeInboundHostname: rejects invalid characters (underscore in domain)", () => {
  assert.equal(normalizeInboundHostname("bad_host.example.com").ok, false);
});

test("normalizeInboundHostname: rejects empty / whitespace", () => {
  assert.equal(normalizeInboundHostname("").ok, false);
  assert.equal(normalizeInboundHostname("   ").ok, false);
});

test("parseWorkspaceTenantLabelFromHost: tenant1.example.com with root example.com → label tenant1", () => {
  const reserved = new Set<string>();
  const o = parseWorkspaceTenantLabelFromHost("tenant1.example.com", "example.com", reserved);
  assert.equal(o.kind, "label");
  if (o.kind === "label") {
    assert.equal(o.label, "tenant1");
  }
});

test("parseWorkspaceTenantLabelFromHost: tenant2 with same root", () => {
  const o = parseWorkspaceTenantLabelFromHost("tenant2.example.com", "example.com", new Set());
  assert.equal(o.kind, "label");
  if (o.kind === "label") {
    assert.equal(o.label, "tenant2");
  }
});

test("parseWorkspaceTenantLabelFromHost: apex example.com → apex", () => {
  const o = parseWorkspaceTenantLabelFromHost("example.com", "example.com", new Set());
  assert.equal(o.kind, "apex");
});

test("parseWorkspaceTenantLabelFromHost: localhost single-label host vs root localhost → apex", () => {
  const o = parseWorkspaceTenantLabelFromHost("localhost", "localhost", new Set());
  assert.equal(o.kind, "apex");
});

test("parseWorkspaceTenantLabelFromHost: owner1.localhost with root localhost", () => {
  const o = parseWorkspaceTenantLabelFromHost("owner1.localhost", "localhost", new Set());
  assert.equal(o.kind, "label");
  if (o.kind === "label") {
    assert.equal(o.label, "owner1");
  }
});

test("parseWorkspaceTenantLabelFromHost: reserved labels (www, api, admin, internal, root)", () => {
  const reserved = new Set(["www", "api", "admin", "internal", "root"]);
  for (const label of reserved) {
    const o = parseWorkspaceTenantLabelFromHost(`${label}.app.example.com`, "app.example.com", reserved);
    assert.equal(o.kind, "reserved", label);
  }
});

test("parseWorkspaceTenantLabelFromHost: outside_workspace when host does not match root suffix", () => {
  const o = parseWorkspaceTenantLabelFromHost("other.net", "example.com", new Set());
  assert.equal(o.kind, "outside_workspace");
});

test("parseWorkspaceTenantLabelFromHost: invalid_label when workspace slug violates TENANT_SUBDOMAIN_REGEX (defensive path)", () => {
  const o = parseWorkspaceTenantLabelFromHost("ab_.example.com", "example.com", new Set());
  assert.equal(o.kind, "invalid_label");
  if (o.kind === "invalid_label") {
    assert.equal(o.label, "ab_");
  }
});

test("parseWorkspaceTenantLabelFromHost: no_root_config", () => {
  const o = parseWorkspaceTenantLabelFromHost("a.example.com", "", new Set());
  assert.equal(o.kind, "no_root_config");
});

test("resolveTenantFromHost: foo.example.com -> foo", () => {
  assert.equal(resolveTenantFromHost("foo.example.com", "example.com"), "foo");
});

test("resolveTenantFromHost: example.com -> null", () => {
  assert.equal(resolveTenantFromHost("example.com", "example.com"), null);
});

test("resolveTenantFromHost: foo.example.com.evil.com -> null", () => {
  assert.equal(resolveTenantFromHost("foo.example.com.evil.com", "example.com"), null);
});

test("extractInboundHost: uses X-Forwarded-Host first when trustForwardedHost is true", () => {
  const req = mockReq({
    headers: { "x-forwarded-host": "t.example.com, evil.example.com" },
    hostname: "wrong.example.com",
    socket: { remoteAddress: "10.0.0.1" } as unknown as Request["socket"]
  });
  const host = TenantHostResolverService.extractInboundHost(req, {
    trustProxy: true,
    trustedProxyCidrs: ["10.0.0.0/8"],
    baseDomain: "example.com"
  });
  assert.equal(host, "t.example.com");
});

test("extractInboundHost: ignores X-Forwarded-Host when trustForwardedHost is false", () => {
  const req = mockReq({
    headers: { "x-forwarded-host": "spoof.example.com" },
    hostname: "real.example.com"
  });
  const host = TenantHostResolverService.extractInboundHost(req, {
    trustProxy: false,
    trustedProxyCidrs: [],
    baseDomain: "example.com"
  });
  assert.equal(host, "real.example.com");
});

test("extractInboundHost: invalid forwarded host falls back to Host", () => {
  const req = mockReq({
    headers: { "x-forwarded-host": "not_a_valid_host!.com" },
    hostname: "fallback.example.com"
  });
  const host = TenantHostResolverService.extractInboundHost(req, {
    trustProxy: true,
    trustedProxyCidrs: ["10.0.0.0/8"],
    baseDomain: "example.com"
  });
  assert.equal(host, "fallback.example.com");
});

test("extractInboundHost: trust proxy true but untrusted remote ignores X-Forwarded-Host", () => {
  const req = mockReq({
    headers: { "x-forwarded-host": "spoof.example.com" },
    hostname: "direct.example.com",
    socket: { remoteAddress: "203.0.113.20" } as unknown as Request["socket"]
  });
  const host = TenantHostResolverService.extractInboundHost(req, {
    trustProxy: true,
    trustedProxyCidrs: ["10.0.0.0/8"],
    baseDomain: "example.com"
  });
  assert.equal(host, "direct.example.com");
});

test("extractInboundHost: trust proxy true with empty CIDRs ignores X-Forwarded-Host", () => {
  const req = mockReq({
    headers: { "x-forwarded-host": "spoof.example.com" },
    hostname: "direct.example.com",
    socket: { remoteAddress: "10.0.0.1" } as unknown as Request["socket"]
  });
  const host = TenantHostResolverService.extractInboundHost(req, {
    trustProxy: true,
    trustedProxyCidrs: [],
    baseDomain: "example.com"
  });
  assert.equal(host, "direct.example.com");
});

test("TenantHostResolverService.stripHostPort edge cases", () => {
  assert.equal(TenantHostResolverService.stripHostPort("h"), "h");
  assert.equal(TenantHostResolverService.stripHostPort("[::1]:3000"), "[::1]");
});

test("resolver cache miss: queries repository and populates cache", async () => {
  const redisOps: Array<string> = [];
  const redis = {
    get: async (_key: string) => {
      redisOps.push("get");
      return null;
    },
    set: async (_key: string, _value: string, _ex: string, _ttl: number) => {
      redisOps.push("set");
      return "OK";
    },
    del: async () => 1,
    quit: async () => undefined
  };
  let dbBySubCalls = 0;
  const repo = {
    createQueryBuilder: (_alias: string) => {
      let whereSub = false;
      const qb = {
        where: (_sql: string) => {
          whereSub = true;
          return qb;
        },
        andWhere: (_sql: string) => qb,
        getOne: async () => {
          if (whereSub) {
            dbBySubCalls += 1;
          }
          return {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            subdomain: "acme",
            deletedAt: null
          };
        }
      };
      return qb;
    }
  };
  const config = {
    getTenantRootDomain: () => "app.example.com",
    getTenantHostReservedSubdomains: () => new Set<string>(),
    isTrustProxyEnabled: () => true
  };
  const obs = {
    recordTenantResolverCacheHit: () => undefined,
    recordTenantResolverCacheMiss: () => undefined
  };
  const svc = new TenantHostResolverService(
    config as never,
    obs as never,
    repo as never,
    redis as never
  );

  const row = await svc.resolveTenantEntityFromHost("acme.app.example.com");
  assert.equal(row?.id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(dbBySubCalls, 1);
  assert.deepEqual(redisOps, ["get", "set"]);
});

test("resolver cache hit: avoids subdomain DB lookup", async () => {
  const redis = {
    get: async (_key: string) => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    set: async () => "OK",
    del: async () => 1,
    quit: async () => undefined
  };
  let byIdCalls = 0;
  const repo = {
    createQueryBuilder: (_alias: string) => {
      const qb = {
        where: (_sql: string) => {
          byIdCalls += 1;
          return qb;
        },
        andWhere: (_sql: string) => qb,
        getOne: async () => ({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          subdomain: "acme",
          deletedAt: null
        })
      };
      return qb;
    }
  };
  let hits = 0;
  let misses = 0;
  const svc = new TenantHostResolverService(
    {
      getTenantRootDomain: () => "app.example.com",
      getTenantHostReservedSubdomains: () => new Set<string>(),
      isTrustProxyEnabled: () => true
    } as never,
    {
      recordTenantResolverCacheHit: () => {
        hits += 1;
      },
      recordTenantResolverCacheMiss: () => {
        misses += 1;
      }
    } as never,
    repo as never,
    redis as never
  );

  const row = await svc.resolveTenantEntityFromHost("acme.app.example.com");
  assert.equal(row?.id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal(hits, 1);
  assert.equal(misses, 0);
  assert.equal(byIdCalls, 1);
});

test("resolver rejects invalid hostname before cache lookup", async () => {
  let redisGetCalls = 0;
  const redis = {
    get: async () => {
      redisGetCalls += 1;
      return null;
    },
    set: async () => "OK",
    del: async () => 1,
    quit: async () => undefined
  };
  const svc = new TenantHostResolverService(
    {
      getTenantRootDomain: () => "app.example.com",
      getTenantHostReservedSubdomains: () => new Set<string>(),
      isTrustProxyEnabled: () => true
    } as never,
    {
      recordTenantResolverCacheHit: () => undefined,
      recordTenantResolverCacheMiss: () => undefined
    } as never,
    {
      createQueryBuilder: () => {
        const qb = {
          where: () => qb,
          andWhere: () => qb,
          getOne: async () => null
        };
        return qb;
      }
    } as never,
    redis as never
  );

  const row = await svc.resolveTenantEntityFromHost("bad_host!.example.com");
  assert.equal(row, null);
  assert.equal(redisGetCalls, 0);
});
