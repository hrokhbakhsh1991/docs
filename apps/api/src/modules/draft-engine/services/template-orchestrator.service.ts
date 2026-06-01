import { Injectable } from "@nestjs/common";
import {
  DenaliTemplateOrchestratorFactory,
  type DenaliTemplateOrchestratorContract,
  type OrchestrationOptions,
  type OrchestrationOutput,
  type WorkspaceTemplatePayload,
} from "@repo/denali-domain";

/**
 * NestJS adapter for headless Denali template → draft orchestration.
 * Enables API routes, migrations, and clone pipelines without React/RHF context trees.
 */
@Injectable()
export class TemplateOrchestratorService {
  private readonly factory: DenaliTemplateOrchestratorContract = new DenaliTemplateOrchestratorFactory();

  createDraftFromTemplate(
    template: WorkspaceTemplatePayload,
    options?: OrchestrationOptions,
  ): Promise<OrchestrationOutput> {
    return this.factory.createDraftFromTemplate(template, options);
  }

  listModernOverlayStoragePaths(): readonly string[] {
    return this.factory.listModernOverlayStoragePaths();
  }
}
