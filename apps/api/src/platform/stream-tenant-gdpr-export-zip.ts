import archiver from "archiver";
import type { ServerResponse } from "node:http";

import type { TenantGdprExportBundle } from "./build-tenant-gdpr-export.ts";

export async function streamTenantGdprExportZip(
  res: ServerResponse,
  bundle: TenantGdprExportBundle
): Promise<void> {
  const tenantId = String(bundle.manifest.tenantId ?? "unknown");
  return new Promise((resolve, reject) => {
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="tenant-${tenantId}-gdpr-export.zip"`,
    });
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.on("end", () => resolve());
    archive.pipe(res);
    const files: Array<[string, unknown]> = [
      ["manifest.json", bundle.manifest],
      ["tenant.json", bundle.tenant],
      ["tenant-configs.json", bundle.tenantConfigs],
      ["user-tenants.json", bundle.userTenants],
      ["operator-pending-invites.json", bundle.operatorPendingInvites],
      ["tours.json", bundle.tours],
      ["tenant-domains.json", bundle.tenantDomains],
      ["audit-events.json", bundle.auditEvents],
      ["platform-audit-events.json", bundle.platformAuditEvents],
    ];
    for (const [name, data] of files) {
      archive.append(JSON.stringify(data, null, 2), { name });
    }
    void archive.finalize();
  });
}
