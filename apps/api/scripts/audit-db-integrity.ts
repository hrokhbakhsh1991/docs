import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadOptionalEnvFile(filename: string) {
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

const dbUrl = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

async function audit() {
  if (!dbUrl) {
    throw new Error("DATABASE_URL or DATABASE_URL_ADMIN must be set.");
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  console.log("[AUDIT] Running Database Integrity Audit...");

  // Find orphaned tenant_config records
  const configOrphans = (await prisma.$queryRaw`
    SELECT tc.tenant_id::text as "tenantId", tc.config_key as "configKey"
    FROM tenant_config tc
    LEFT JOIN tenants t ON tc.tenant_id = t.id
    WHERE t.id IS NULL
  `) as { tenantId: string; configKey: string }[];

  // Find orphaned workspace_equipment records
  const equipmentOrphans = (await prisma.$queryRaw`
    SELECT we.tenant_id::text as "tenantId", we.id::text as "equipmentId", we.name
    FROM workspace_equipment we
    LEFT JOIN tenants t ON we.tenant_id = t.id
    WHERE t.id IS NULL
  `) as { tenantId: string; equipmentId: string; name: string }[];

  console.log(`[AUDIT] Found ${configOrphans.length} orphaned tenant_config rows.`);
  console.log(`[AUDIT] Found ${equipmentOrphans.length} orphaned workspace_equipment rows.`);

  // Write/append to SYSTEM_HEALTH_REPORT.md in root
  const reportPath = path.resolve(API_ROOT, "../../SYSTEM_HEALTH_REPORT.md");
  
  let content = "## 1. Database Integrity Audit\n\n";
  content += `**Audit Timestamp:** ${new Date().toISOString()}\n\n`;

  if (configOrphans.length === 0 && equipmentOrphans.length === 0) {
    content += "✅ **Status: Healthy.** No orphaned records or broken foreign key links found in `tenant_config` or `workspace_equipment`.\n";
  } else {
    content += "⚠️ **Status: Integrity Issues Detected.**\n\n";
    if (configOrphans.length > 0) {
      content += "### Broken tenant_config Links\n\n";
      content += "| Tenant ID | Config Key |\n";
      content += "| --- | --- |\n";
      for (const row of configOrphans) {
        content += `| \`${row.tenantId}\` | \`${row.configKey}\` |\n`;
      }
      content += "\n";
    }
    if (equipmentOrphans.length > 0) {
      content += "### Broken workspace_equipment Links\n\n";
      content += "| Tenant ID | Equipment ID | Name |\n";
      content += "| --- | --- | --- |\n";
      for (const row of equipmentOrphans) {
        content += `| \`${row.tenantId}\` | \`${row.equipmentId}\` | ${row.name} |\n`;
      }
      content += "\n";
    }
  }

  fs.writeFileSync(reportPath, content, { encoding: "utf8" });
  console.log(`[AUDIT] Report written successfully to: ${reportPath}`);

  await prisma.$disconnect();
}

audit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
