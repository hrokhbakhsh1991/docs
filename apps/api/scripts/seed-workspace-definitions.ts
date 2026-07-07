import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getPrismaAdmin } from "../src/db/prisma.ts";
import {
  parseWorkspaceDefinitionExportFile,
  type WorkspaceDefinitionExportFile,
} from "../src/workspace-metadata/build-workspace-definition-export.ts";

const DEFINITIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "seed/definitions");

export async function seedWorkspaceDefinitionsFromDir(
  definitionsDir: string = DEFINITIONS_DIR
): Promise<readonly WorkspaceDefinitionExportFile[]> {
  const prisma = getPrismaAdmin();
  let entries: string[];
  try {
    entries = await readdir(definitionsDir);
  } catch {
    return [];
  }

  const jsonFiles = entries.filter((name) => name.endsWith(".json")).sort();
  const seeded: WorkspaceDefinitionExportFile[] = [];

  for (const fileName of jsonFiles) {
    const raw = JSON.parse(await readFile(join(definitionsDir, fileName), "utf8")) as unknown;
    const exported = parseWorkspaceDefinitionExportFile(raw);

    await prisma.workspaceDefinition.upsert({
      where: { id: exported.definitionId },
      create: {
        id: exported.definitionId,
        displayName: exported.displayName,
        status: "published",
      },
      update: {
        displayName: exported.displayName,
        status: "published",
      },
    });

    await prisma.workspaceDefinitionVersion.upsert({
      where: {
        definitionId_version: {
          definitionId: exported.definitionId,
          version: exported.version,
        },
      },
      create: {
        definitionId: exported.definitionId,
        version: exported.version,
        pluginApiVersion: exported.payload.contractVersion,
        payload: exported.payload,
        checksum: exported.checksum,
        publishedAt: new Date(),
      },
      update: {
        pluginApiVersion: exported.payload.contractVersion,
        payload: exported.payload,
        checksum: exported.checksum,
        publishedAt: new Date(),
      },
    });

    seeded.push(exported);
  }

  return seeded;
}
