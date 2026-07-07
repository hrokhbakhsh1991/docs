import { headers } from "next/headers";

import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export const dynamic = "force-dynamic";

type AuditListResponse = {
  items?: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorId: string | null;
    createdAt: string;
  }>;
};

export default async function PlatformAuditPage() {
  const headerList = await headers();
  const req = new Request("http://platform.local/platform/audit", {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });
  const upstream = await proxyPlatformApi(req, "/platform/v1/audit?limit=50&offset=0");
  const body = upstream.ok
    ? ((await upstream.json().catch(() => ({}))) as AuditListResponse)
    : {};
  const items = Array.isArray(body.items) ? body.items : [];

  return (
    <div className="space-y-6" data-testid="platform-audit-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">Platform operator actions</p>
        </div>
        <a
          href="/api/platform/audit/export?from=1970-01-01T00:00:00.000Z&to=2099-12-31T23:59:59.999Z"
          data-audit-export-download
          className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm"
        >
          Download CSV
        </a>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Actor</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No audit events yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-border" data-testid="audit-row">
                  <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{item.action}</td>
                  <td className="px-4 py-3">
                    {item.entityType}:{item.entityId}
                  </td>
                  <td className="px-4 py-3">{item.actorId ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
