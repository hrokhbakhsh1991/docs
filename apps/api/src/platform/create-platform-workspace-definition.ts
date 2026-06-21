import { PlatformDefinitionConflict } from "./platform.errors.ts";
import { WorkspaceDefinitionRepository } from "../workspace-metadata/workspace-definition.repository.ts";

export async function createPlatformWorkspaceDefinition(input: {
  readonly id: string;
  readonly displayName: string;
  readonly repository?: WorkspaceDefinitionRepository;
}): Promise<{ readonly id: string; readonly displayName: string; readonly status: string }> {
  const repository = input.repository ?? new WorkspaceDefinitionRepository();
  const existing = await repository.getDefinitionById(input.id);
  if (existing) {
    throw new PlatformDefinitionConflict(`workspace definition already exists: ${input.id}`);
  }
  try {
    return await repository.createDefinition({
      id: input.id,
      displayName: input.displayName,
    });
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new PlatformDefinitionConflict(`workspace definition already exists: ${input.id}`);
    }
    throw error;
  }
}
