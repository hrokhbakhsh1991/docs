#!/usr/bin/env node
/**
 * P3-D — provision a starter metadata vertical smoke tenant binding.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node --import tsx apps/api/scripts/provision-metadata-vertical.ts
 *   node --import tsx apps/api/scripts/provision-metadata-vertical.ts --definition starter-shell --version 1
 */
import assert from "node:assert/strict";

import { getPrismaAdmin } from "../src/db/prisma.ts";

const args = process.argv.slice(2);
const definitionFlagIndex = args.indexOf("--definition");
const versionFlagIndex = args.indexOf("--version");
const definitionId =
  definitionFlagIndex >= 0 ? (args[definitionFlagIndex + 1] ?? "starter-shell") : "starter-shell";
const version =
  versionFlagIndex >= 0 ? Number.parseInt(args[versionFlagIndex + 1] ?? "1", 10) : 1;

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required");
  }

  const prisma = getPrismaAdmin();
  const definition = await prisma.workspaceDefinition.findUnique({
    where: { id: definitionId },
    select: { id: true, displayName: true },
  });
  assert.ok(definition, `workspace definition not found: ${definitionId}`);

  const versionRow = await prisma.workspaceDefinitionVersion.findUnique({
    where: {
      definitionId_version: { definitionId, version },
    },
    select: { version: true, publishedAt: true },
  });
  assert.ok(versionRow?.publishedAt, `published version not found: ${definitionId}@${version}`);

  let tenant = await prisma.tenant.findFirst({
    where: { workspaceType: "starter", status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true, subdomain: true },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        subdomain: `metadata-smoke-${Date.now().toString(36)}`,
        workspaceType: "starter",
        status: "active",
      },
      select: { id: true, subdomain: true },
    });
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      workspaceDefinitionId: definitionId,
      workspaceDefinitionVersion: version,
    },
  });

  console.log(
    JSON.stringify(
      {
        tenantId: tenant.id,
        subdomain: tenant.subdomain,
        workspaceType: "starter",
        workspaceDefinition: { definitionId, definitionVersion: version },
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
