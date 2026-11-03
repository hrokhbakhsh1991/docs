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

export function resolveStagingAdminSmokeHost(rawOriginMap, rawAllowedHosts, rawMarketingOrigin) {
  let originMap;
  try {
    originMap = JSON.parse(rawOriginMap);
  } catch {
    throw new Error("TENANT_SURFACE_ORIGIN_MAP_JSON must contain valid JSON");
  }

  let marketingOrigin;
  try {
    const authority = rawMarketingOrigin.match(/^https:\/\/([^/?#]+)\/?$/i)?.[1];
    const parsed = new URL(rawMarketingOrigin);
    if (
      !authority ||
      authority.includes(":") ||
      parsed.protocol !== "https:" ||
      parsed.port ||
      parsed.username ||
      parsed.password ||
      parsed.hostname.endsWith(".") ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      throw new Error("invalid marketing origin");
    marketingOrigin = parsed.origin;
  } catch {
    throw new Error("MARKETING_PUBLIC_BASE_URL must be a valid HTTPS origin");
  }
  const tenants = Array.isArray(originMap?.tenants) ? originMap.tenants : [];
  const matches = tenants.filter((tenant) => {
    const aliases = Array.isArray(tenant.aliases?.marketing) ? tenant.aliases.marketing : [];
    return (
      tenant.origins?.marketing === marketingOrigin ||
      aliases.some((alias) => alias?.origin === marketingOrigin)
    );
  });
  if (matches.length !== 1) {
    throw new Error("configured marketing origin must map to exactly one tenant");
  }
  const tenant = matches[0];

  const allowedHosts = normalizeAllowedHosts(rawAllowedHosts);
  if (allowedHosts.size === 0) {
    throw new Error("OPERATOR_ADMIN_ROOT_HOSTS must be configured for the staging web smoke");
  }

  const mappedOrigins = [
    tenant.origins?.admin,
    ...(Array.isArray(tenant.aliases?.admin)
      ? tenant.aliases.admin.map((alias) => alias?.origin)
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
      "configured operator admin host is not explicitly mapped to the selected tenant's admin surface"
    );
  }
  return new URL(matchingOrigin).hostname;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.stdout.write(
      resolveStagingAdminSmokeHost(
        process.argv[2] ?? "",
        process.argv[3] ?? "",
        process.argv[4] ?? ""
      )
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "invalid staging admin smoke host"}\n`
    );
    process.exitCode = 1;
  }
}
