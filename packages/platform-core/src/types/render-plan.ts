import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk/plugin-types";

export interface RenderFieldPlan {
  readonly fieldId: string;
  readonly kind: WorkspaceFieldKind;
  readonly canonicalPath: string;
  readonly required: boolean;
  readonly hidden: boolean;
  readonly stepId: string;
  /** Hints for ui-primitives — generic strings only */
  readonly uiHints?: Readonly<Record<string, string>>;
}

export interface RenderStepPlan {
  readonly stepId: string;
  readonly fields: readonly RenderFieldPlan[];
  readonly uiHints?: Readonly<Record<string, string>>;
}
