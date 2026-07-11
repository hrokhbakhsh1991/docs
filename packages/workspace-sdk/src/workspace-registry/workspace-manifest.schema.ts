import { z } from "zod";

const pluginEntrySchema = z.object({
  entry: z.string().min(1),
  export: z.string().min(1),
});

/**
 * Structural authority for `workspace.manifest.json`.
 * Additional manifest blocks pass through via `.passthrough()` for forward compatibility.
 */
export const WorkspaceManifestSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    package: z.string().min(1),
    workspaceTypes: z.array(z.string().min(1)).min(1),
    plugin: pluginEntrySchema,
    web: pluginEntrySchema.optional(),
    pluginApiVersion: z.number().int().positive().optional(),
    theme: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

/** Inferred manifest shape — single source of truth with runtime Zod validation. */
export type WorkspaceManifestRecord = z.infer<typeof WorkspaceManifestSchema>;

export type WorkspaceRegistryEntry = Readonly<{
  readonly workspaceId: string;
  readonly manifest: WorkspaceManifestRecord;
  readonly manifestPath: string;
}>;

export function parseWorkspaceManifest(
  raw: unknown,
  context: string,
): WorkspaceManifestRecord {
  const parsed = WorkspaceManifestSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`WORKSPACE_MANIFEST_INVALID:${context}:${detail}`);
  }
  return parsed.data;
}
