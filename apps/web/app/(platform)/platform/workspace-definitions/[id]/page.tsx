import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { BuilderShell } from "@/platform/workspace-builder/builder-shell";
import { readPlatformOpsSessionFromCookies } from "@/platform/read-platform-session.server";
import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";
import type { WorkspaceDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

export const dynamic = "force-dynamic";

type ListResponse = {
  items?: Array<{
    id: string;
    displayName: string;
    latestPublishedVersion: number | null;
  }>;
};

type VersionResponse = {
  version?: number;
  payload?: WorkspaceDefinitionPayload;
};

export default async function PlatformWorkspaceDefinitionBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const headerList = await headers();
  const req = new Request(`http://platform.local/platform/workspace-definitions/${id}`, {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });

  const listUpstream = await proxyPlatformApi(req, "/platform/v1/workspace-definitions");
  const listBody = listUpstream.ok
    ? ((await listUpstream.json().catch(() => ({}))) as ListResponse)
    : {};
  const definition = (listBody.items ?? []).find((item) => item.id === id);
  if (!definition) {
    notFound();
  }

  const versionNumber =
    query.version !== undefined
      ? Number.parseInt(query.version, 10)
      : definition.latestPublishedVersion;

  let initialPayload: WorkspaceDefinitionPayload | null = null;
  let basedOnVersion: number | null = null;

  if (versionNumber !== null && Number.isFinite(versionNumber) && versionNumber > 0) {
    const versionUpstream = await proxyPlatformApi(
      req,
      `/platform/v1/workspace-definitions/${id}/versions/${versionNumber}`
    );
    if (versionUpstream.ok) {
      const versionBody = (await versionUpstream.json().catch(() => ({}))) as VersionResponse;
      if (versionBody.payload) {
        initialPayload = versionBody.payload;
        basedOnVersion = versionBody.version ?? versionNumber;
      }
    }
  }

  const session = await readPlatformOpsSessionFromCookies();
  const isOwner = session?.role === "owner";

  return (
    <div className="space-y-4">
      <Link
        href="/platform/workspace-definitions"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to workspaces
      </Link>
      <BuilderShell
        definitionId={definition.id}
        displayName={definition.displayName}
        basedOnVersion={basedOnVersion}
        initialPayload={initialPayload}
        isOwner={isOwner}
      />
    </div>
  );
}
