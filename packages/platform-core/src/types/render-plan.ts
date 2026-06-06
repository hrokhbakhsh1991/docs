import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk/plugin-types";

export interface RenderFieldPlan {
  readonly fieldId: string;
  readonly kind: WorkspaceFieldKind;
  readonly canonicalPath: string;
  readonly required: boolean;
  /**
   * Always `false` on emitted rows — **not** the visibility authority.
   * Hidden fields are **omitted** from `RenderStepPlan.fields` (see `buildRenderPlan` in `render-plan.ts`).
   * Consumers (phase 3+ UI) must not treat this flag as dynamic rule visibility.
   */
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
