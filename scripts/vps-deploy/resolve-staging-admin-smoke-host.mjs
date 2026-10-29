const tenantAMarketingOrigin = "https://denali.staging.test";

function normalizeAllowedHosts(rawHosts) {
  return new Set(
    rawHosts
      .split(",")
      .map((rawHost) => rawHost.trim())
      .filter(Boolean)
      .map((rawHost) => {
        if (rawHost.includes(":")) {
          throw new Error(
            "OPERATOR_ADMIN_ROOT_HOSTS must contain hostnames without ports or paths"
          );
        }
        const parsed = new URL(`https://${rawHost}`);
        if (
          parsed.port ||
          parsed.username ||
          parsed.password ||
          parsed.pathname !== "/" ||
          parsed.search ||
          parsed.hash
        ) {
          throw new Error(
            "OPERATOR_ADMIN_ROOT_HOSTS must contain hostnames without ports or paths"
          );
        }
        return parsed.hostname.toLowerCase();
      })
  );
}

export function resolveStagingAdminSmokeHost(rawOriginMap, rawAllowedHosts) {
  let originMap;
  try {
    originMap = JSON.parse(rawOriginMap);
  } catch {
    throw new Error("TENANT_SURFACE_ORIGIN_MAP_JSON must contain valid JSON");
  }

  const tenantA = originMap?.tenants?.find(
    (tenant) => tenant.origins?.marketing === tenantAMarketingOrigin
  );
  if (!tenantA) {
    throw new Error("tenant A is missing from TENANT_SURFACE_ORIGIN_MAP_JSON");
  }

  const allowedHosts = normalizeAllowedHosts(rawAllowedHosts);
  if (allowedHosts.size === 0) {
    throw new Error("OPERATOR_ADMIN_ROOT_HOSTS must be configured for the staging web smoke");
  }

  const mappedOrigins = [
    tenantA.origins?.admin,
    ...(Array.isArray(tenantA.aliases?.admin)
      ? tenantA.aliases.admin.map((alias) => alias?.origin)
      : []),
  ];
  const matchingOrigin = mappedOrigins.find((origin) => {
    if (typeof origin !== "string") return false;
    try {
      const parsed = new URL(origin);
      return (
        parsed.protocol === "https:" &&
        parsed.port === "" &&
        parsed.username === "" &&
        parsed.password === "" &&
        parsed.pathname === "/" &&
        parsed.search === "" &&
        parsed.hash === "" &&
        allowedHosts.has(parsed.hostname.toLowerCase())
      );
    } catch {
      return false;
    }
  });

  if (!matchingOrigin) {
    throw new Error(
      "configured operator admin host is not explicitly mapped to tenant A's admin surface"
    );
  }
  return new URL(matchingOrigin).hostname;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.stdout.write(
      resolveStagingAdminSmokeHost(process.argv[2] ?? "", process.argv[3] ?? "")
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "invalid staging admin smoke host"}\n`
    );
    process.exitCode = 1;
  }
}
