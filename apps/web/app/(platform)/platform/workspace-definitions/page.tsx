import Link from "next/link";
import { headers } from "next/headers";

import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export const dynamic = "force-dynamic";

type WorkspaceDefinitionsResponse = {
  items?: Array<{
    id: string;
    displayName: string;
    status: string;
    latestPublishedVersion: number | null;
  }>;
};

export default async function PlatformWorkspaceDefinitionsPage() {
  const headerList = await headers();
  const req = new Request("http://platform.local/platform/workspace-definitions", {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });
  const upstream = await proxyPlatformApi(req, "/platform/v1/workspace-definitions");
  const body = upstream.ok
    ? ((await upstream.json().catch(() => ({}))) as WorkspaceDefinitionsResponse)
    : {};
  const items = Array.isArray(body.items) ? body.items : [];

  return (
    <div className="space-y-6" data-platform-workspace-definitions-page>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          Author and publish workspace metadata definitions
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Id</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Latest version</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No workspace definitions yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      href={`/platform/workspace-definitions/${item.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{item.displayName}</td>
                  <td className="px-4 py-3">{item.status}</td>
                  <td className="px-4 py-3">{item.latestPublishedVersion ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
