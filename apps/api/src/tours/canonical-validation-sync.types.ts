import type { CreateTourBody } from "./create-tour.schema";
import type { CatalogRefAllowlists } from "../canonical/assert-catalog-ref-integrity.ts";

export type ValidationMode = "draft" | "publish";

export type ValidateBeforePersistInput = {
  readonly body: CreateTourBody;
  readonly tenantId: string;
  readonly workspaceType: string;
  /** RuleContext variant — `default` (advanced) or `basic` (degraded). DEC-014. */
  readonly validationVariant?: "default" | "basic";
  /** P5-B-N-005 — draft-relaxed vs publish-strict (inferred from publishStatus when omitted). */
  readonly validationMode?: ValidationMode;
  /** P5-B-N-008 — inject tenant catalog allowlists (production enrich loads automatically). */
  readonly catalogRefAllowlists?: CatalogRefAllowlists;
};
