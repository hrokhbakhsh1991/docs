import { PlatformValidation } from "./platform.errors.ts";

/** Aligns with tenant-kernel validation. */
const TENANT_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const DEFAULT_RESERVED_LABELS = [
  "www",
  "api",
  "app",
  "mail",
  "ftp",
  "cdn",
  "static",
  "assets",
  "localhost",
  "staging",
  "admin",
  "internal",
  "root",
] as const;

function parseReservedLabelsCsv(csv: string | undefined): Set<string> {
  if (!csv?.trim()) {
    return new Set(DEFAULT_RESERVED_LABELS);
  }
  return new Set(
    csv
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * P1-N-039: Assert subdomain is available for tenant provisioning.
 * Validates regex, reserved names, and DB uniqueness.
 */
export async function assertSubdomainAvailable(subdomain: string): Promise<void> {
  // 1. Validate regex
  if (!TENANT_SUBDOMAIN_REGEX.test(subdomain)) {
    throw new PlatformValidation(
      `Invalid subdomain format: ${subdomain}. Must match ${TENANT_SUBDOMAIN_REGEX.source}`
    );
  }

  // 2. Check reserved names
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  if (reserved.has(subdomain.toLowerCase())) {
    throw new PlatformValidation(`Subdomain "${subdomain}" is reserved and cannot be used`);
  }

  // 3. Check DB uniqueness
  const { getPrismaAdmin } = require("../db/prisma") as typeof import("../db/prisma");
  const prisma = getPrismaAdmin();
  const existing = await prisma.tenant.findUnique({
    where: { subdomain },
    select: { id: true },
  });

  if (existing) {
    throw new PlatformValidation(`Subdomain "${subdomain}" is already taken`);
  }
}

// Made with Bob
