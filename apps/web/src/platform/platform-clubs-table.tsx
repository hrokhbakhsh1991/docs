import { OPERATOR_SUCCESS_BADGE_CLASS } from "@/admin/patterns/operator-semantic-surfaces";
import Link from "next/link";

import { WorkspaceProductionCertificationBadge } from "./workspace-production-certification-badge";
import { tryResolveWorkspaceProductionTier } from "./resolve-workspace-production-tier";

type PlatformTenantRow = {
  readonly id: string;
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly status: string;
};

export type PlatformClubsTableProps = {
  readonly items: readonly PlatformTenantRow[];
};

export function PlatformClubsTable({ items }: PlatformClubsTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No clubs yet. Create your first club to get started.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Subdomain</th>
            <th className="px-4 py-3 font-medium">Workspace</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium">
                <Link href={`/platform/clubs/${item.id}`} className="hover:underline">
                  {item.subdomain}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  <span>{item.workspaceType}</span>
                  {(() => {
                    const tier = tryResolveWorkspaceProductionTier(item.workspaceType);
                    return tier ? <WorkspaceProductionCertificationBadge tier={tier} /> : null;
                  })()}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  data-status={item.status}
                  className={
                    item.status === "suspended"
                      ? "rounded-full bg-destructive/10 px-2 py-0.5 text-destructive"
                      : OPERATOR_SUCCESS_BADGE_CLASS
                  }
                >
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
