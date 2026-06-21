import { headers } from "next/headers";

import { TeamInviteForm } from "@/platform/team/team-invite-form";
import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";
import { readPlatformOpsSessionFromCookies } from "@/platform/read-platform-session.server";

export const dynamic = "force-dynamic";

type TeamListResponse = {
  items?: Array<{
    phone: string;
    role: string;
    createdAt: string;
  }>;
};

export default async function PlatformTeamPage() {
  const session = await readPlatformOpsSessionFromCookies();
  const headerList = await headers();
  const req = new Request("http://platform.local/platform/team", {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });
  const upstream = await proxyPlatformApi(req, "/platform/v1/team");
  const body = upstream.ok
    ? ((await upstream.json().catch(() => ({}))) as TeamListResponse)
    : {};
  const items = Array.isArray(body.items) ? body.items : [];
  const canInvite = session?.role === "owner";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Platform operator accounts</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  No team members yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.phone} className="border-t border-border">
                  <td className="px-4 py-3">{item.phone}</td>
                  <td className="px-4 py-3 font-medium">{item.role}</td>
                  <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TeamInviteForm canInvite={canInvite} />
    </div>
  );
}
