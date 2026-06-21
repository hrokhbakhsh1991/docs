import { getPrismaAdmin } from "../db/prisma.ts";

export type PlatformWorkspaceDefinitionListItem = {
  readonly id: string;
  readonly displayName: string;
  readonly status: string;
  readonly latestPublishedVersion: number | null;
};

export async function listPlatformWorkspaceDefinitions(): Promise<
  readonly PlatformWorkspaceDefinitionListItem[]
> {
  const prisma = getPrismaAdmin();
  const rows = await prisma.workspaceDefinition.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      displayName: true,
      status: true,
      versions: {
        where: { publishedAt: { not: null } },
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    status: row.status,
    latestPublishedVersion: row.versions[0]?.version ?? null,
  }));
}
