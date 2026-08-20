/**
 * Owner DB Hardening 1-A — live owner-cardinality audit (admin / bypass-RLS).
 * Authority: docs/phase-9/appendices/owner-cardinality-db-hardening-1a.mdoc
 *
 * Usage:
 *   DATABASE_URL_ADMIN=... pnpm --filter @apps/api run audit:owner-cardinality
 *
 * Exit codes:
 *   0 — no multi-ACTIVE-owner tenants (audit green for index apply)
 *   1 — connection / query failure
 *   2 — multi-ACTIVE-owner findings (do not apply index until remediated)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_DIR = path.resolve(API_ROOT, "../../docs/phase-9/appendices");
const REPORT_PATH = path.join(REPORT_DIR, "OWNER-CARDINALITY-AUDIT-REPORT.md");

function loadOptionalEnvFile(filename: string): void {
  const filePath = path.join(API_ROOT, filename);
  if (!fs.existsSync(filePath)) {
    return;
  }
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadOptionalEnvFile(".env");
loadOptionalEnvFile(".env.local");

type MultiOwnerRow = {
  tenant_id: string;
  active_owner_count: number;
  owner_user_ids: string[];
};

type ZeroOwnerRow = {
  tenant_id: string;
  classification: "provisioning" | "invalid_active_tenant";
  membership_count: number;
};

type DistRow = { key: string; row_count: number };

type SoftOwnerRow = {
  tenant_id: string;
  user_id: string;
  status: string;
  created_at: Date;
};

function mdTable(headers: string[], rows: string[][]): string {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL_ADMIN?.trim() || process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error(
      "[OWNER-AUDIT] DATABASE_URL_ADMIN (preferred) or DATABASE_URL required for staging audit."
    );
    process.exit(1);
  }

  const usingAdmin = Boolean(process.env.DATABASE_URL_ADMIN?.trim());
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  const timestamp = new Date().toISOString();

  console.log(`[OWNER-AUDIT] Starting at ${timestamp}`);
  console.log(`[OWNER-AUDIT] Connection: ${usingAdmin ? "DATABASE_URL_ADMIN" : "DATABASE_URL"}`);

  try {
    const multiOwners = (await prisma.$queryRaw`
      SELECT
        ut.tenant_id::text AS tenant_id,
        COUNT(*)::int AS active_owner_count,
        array_agg(ut.user_id::text ORDER BY ut.created_at, ut.user_id) AS owner_user_ids
      FROM user_tenants ut
      WHERE ut.role = 'owner'
        AND ut.status = 'ACTIVE'
      GROUP BY ut.tenant_id
      HAVING COUNT(*) > 1
      ORDER BY active_owner_count DESC, ut.tenant_id
    `) as MultiOwnerRow[];

    const zeroOwners = (await prisma.$queryRaw`
      WITH tenants_with_membership AS (
        SELECT DISTINCT tenant_id FROM user_tenants
      ),
      active_owner_tenants AS (
        SELECT DISTINCT tenant_id
        FROM user_tenants
        WHERE role = 'owner' AND status = 'ACTIVE'
      ),
      pending_owner_invites AS (
        SELECT DISTINCT tenant_id
        FROM operator_pending_invites
        WHERE role = 'owner' AND status = 'INVITED'
      )
      SELECT
        twm.tenant_id::text AS tenant_id,
        CASE
          WHEN poi.tenant_id IS NOT NULL THEN 'provisioning'
          ELSE 'invalid_active_tenant'
        END AS classification,
        (
          SELECT COUNT(*)::int FROM user_tenants ut WHERE ut.tenant_id = twm.tenant_id
        ) AS membership_count
      FROM tenants_with_membership twm
      LEFT JOIN active_owner_tenants aot ON aot.tenant_id = twm.tenant_id
      LEFT JOIN pending_owner_invites poi ON poi.tenant_id = twm.tenant_id
      WHERE aot.tenant_id IS NULL
      ORDER BY classification, twm.tenant_id
    `) as ZeroOwnerRow[];

    const roleDist = (await prisma.$queryRaw`
      SELECT role AS key, COUNT(*)::int AS row_count
      FROM user_tenants
      GROUP BY role
      ORDER BY row_count DESC, role
    `) as DistRow[];

    const statusDist = (await prisma.$queryRaw`
      SELECT status AS key, COUNT(*)::int AS row_count
      FROM user_tenants
      GROUP BY status
      ORDER BY row_count DESC, status
    `) as DistRow[];

    const softOwners = (await prisma.$queryRaw`
      SELECT
        ut.tenant_id::text AS tenant_id,
        ut.user_id::text AS user_id,
        ut.status,
        ut.created_at
      FROM user_tenants ut
      WHERE ut.role = 'owner'
        AND ut.status <> 'ACTIVE'
      ORDER BY ut.tenant_id, ut.created_at
    `) as SoftOwnerRow[];

    const provisioning = zeroOwners.filter((row) => row.classification === "provisioning");
    const invalidZero = zeroOwners.filter((row) => row.classification === "invalid_active_tenant");
    const auditGreen = multiOwners.length === 0;

    let report = `# Owner Cardinality Audit Report\n\n`;
    report += `**Timestamp:** ${timestamp}\n\n`;
    report += `**Connection:** ${usingAdmin ? "DATABASE_URL_ADMIN" : "DATABASE_URL"}\n\n`;
    report += `**Index apply gate (multi-ACTIVE-owner):** ${
      auditGreen ? "GREEN" : "BLOCKED — remediate first"
    }\n\n`;
    report += `> Auto-fix is forbidden. Manual actions only.\n\n`;

    report += `## 1. Multiple ACTIVE owners\n\n`;
    report += `Count: **${multiOwners.length}** tenant(s)\n\n`;
    if (multiOwners.length === 0) {
      report += `None.\n\n`;
    } else {
      report += mdTable(
        ["Tenant", "ACTIVE owner count", "Owner user IDs", "Recommended action"],
        multiOwners.map((row) => [
          `\`${row.tenant_id}\``,
          String(row.active_owner_count),
          row.owner_user_ids.map((id) => `\`${id}\``).join(", "),
          "Keep one owner; demote others to admin via controlled ops",
        ])
      );
      report += `\n`;
    }

    report += `## 2. Zero ACTIVE owners (with memberships)\n\n`;
    report += `Provisioning (pending owner invite): **${provisioning.length}**\n\n`;
    report += `Invalid active tenant: **${invalidZero.length}**\n\n`;
    if (zeroOwners.length === 0) {
      report += `None.\n\n`;
    } else {
      report += mdTable(
        ["Tenant", "Classification", "Memberships", "Recommended action"],
        zeroOwners.map((row) => [
          `\`${row.tenant_id}\``,
          row.classification,
          String(row.membership_count),
          row.classification === "provisioning"
            ? "Leave — wait for owner invite accept"
            : "Bootstrap owner invite or assign owner via ops",
        ])
      );
      report += `\n`;
    }

    report += `## 3. Role distribution\n\n`;
    report += mdTable(
      ["Role", "Count"],
      roleDist.map((row) => [`\`${row.key}\``, String(row.row_count)])
    );
    report += `\n`;

    report += `## 4. Status distribution\n\n`;
    report += mdTable(
      ["Status", "Count"],
      statusDist.map((row) => [`\`${row.key}\``, String(row.row_count)])
    );
    report += `\n`;

    report += `## 5. Soft owners (role=owner, status ≠ ACTIVE)\n\n`;
    report += `Count: **${softOwners.length}**\n\n`;
    if (softOwners.length === 0) {
      report += `None.\n\n`;
    } else {
      report += mdTable(
        ["Tenant", "User", "Status", "Created"],
        softOwners.map((row) => [
          `\`${row.tenant_id}\``,
          `\`${row.user_id}\``,
          `\`${row.status}\``,
          row.created_at.toISOString(),
        ])
      );
      report += `\n`;
    }

    report += `## Remediation summary\n\n`;
    if (auditGreen && invalidZero.length === 0) {
      report += `No blocking multi-owner rows. Invalid zero-owner tenants: 0. Safe to apply partial unique index migration after operator review.\n`;
    } else if (auditGreen) {
      report += `No multi-owner rows (index create allowed). Invalid zero-owner tenants remain for **manual** remediation (index allows zero ACTIVE owners for provisioning).\n`;
    } else {
      report += `**Do not apply** \`uq_user_tenants_one_active_owner\` until every multi-ACTIVE-owner tenant is remediated.\n`;
    }

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_PATH, report, "utf8");

    console.log(`[OWNER-AUDIT] Multiple ACTIVE owners: ${multiOwners.length}`);
    console.log(`[OWNER-AUDIT] Zero ACTIVE (provisioning): ${provisioning.length}`);
    console.log(`[OWNER-AUDIT] Zero ACTIVE (invalid): ${invalidZero.length}`);
    console.log(`[OWNER-AUDIT] Soft owners: ${softOwners.length}`);
    console.log(`[OWNER-AUDIT] Report: ${REPORT_PATH}`);
    console.log(`[OWNER-AUDIT] Index gate: ${auditGreen ? "GREEN" : "BLOCKED"}`);

    if (!auditGreen) {
      process.exit(2);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[OWNER-AUDIT] Failed:", err);
  process.exit(1);
});
