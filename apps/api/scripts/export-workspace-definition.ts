#!/usr/bin/env node
/**
 * P3-A A4 — export package workspace plugin → JSON definition snapshot.
 *
 * Run:
 *   pnpm --filter @apps/api run export:workspace-definition -- --workspace denali --out scripts/seed/definitions/denali-v1.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildWorkspaceDefinitionExport,
  DEFAULT_WORKSPACE_DEFINITION_EXPORTS,
} from "../src/workspace-metadata/build-workspace-definition-export.ts";
import { logger } from "../src/observability/logger.ts";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin.ts";

function parseArgs(argv: string[]): {
  workspace: string;
  out: string;
  definitionId?: string;
  displayName?: string;
} {
  let workspace = "denali";
  let out = "";
  let definitionId: string | undefined;
  let displayName: string | undefined;

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--workspace" && argv[i + 1]) {
      workspace = argv[++i] ?? workspace;
      continue;
    }
    if (arg === "--out" && argv[i + 1]) {
      out = argv[++i] ?? out;
      continue;
    }
    if (arg === "--definition-id" && argv[i + 1]) {
      definitionId = argv[++i];
      continue;
    }
    if (arg === "--display-name" && argv[i + 1]) {
      displayName = argv[++i];
      continue;
    }
  }

  if (!out) {
    out = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "seed/definitions",
      `${workspace}-v1.json`
    );
  } else if (!out.startsWith("/")) {
    out = resolve(process.cwd(), out);
  }

  return { workspace, out, definitionId, displayName };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const defaults = DEFAULT_WORKSPACE_DEFINITION_EXPORTS[args.workspace];
  if (!defaults && !args.definitionId) {
    throw new Error(`UNKNOWN_WORKSPACE_EXPORT:${args.workspace}`);
  }

  const meta = {
    definitionId: args.definitionId ?? defaults!.definitionId,
    displayName: args.displayName ?? defaults!.displayName,
    workspaceType: defaults?.workspaceType ?? args.workspace,
  };

  const plugin = resolveWorkspacePluginForType(meta.workspaceType);
  const exported = buildWorkspaceDefinitionExport({ plugin, meta });

  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(exported, null, 2)}\n`, "utf8");

  logger.info(
    {
      event: "workspace.definition.exported",
      workspace: meta.workspaceType,
      definitionId: meta.definitionId,
      checksum: exported.checksum,
      out: args.out,
    },
    "workspace definition exported"
  );
}

main().catch((error: unknown) => {
  logger.error(
    {
      event: "workspace.definition.export_failed",
      code: "WORKSPACE_DEFINITION_EXPORT_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
    "workspace definition export failed"
  );
  process.exit(1);
});
