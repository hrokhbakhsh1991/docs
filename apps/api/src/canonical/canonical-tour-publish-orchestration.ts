import type { CanonicalDocument, WorkspaceLifecycleContract } from "@app-tour/workspace-sdk";
import type { TourPublishVisibilityBucket } from "@app-tour/tour-core";

import { assertTourPublishLifecycleOnUpdate } from "./assert-tour-publish-lifecycle-gate";

export type CanonicalTourWritePublishGateInput = {
  readonly workspaceType: string;
  readonly lifecycle: WorkspaceLifecycleContract;
  readonly before: CanonicalDocument;
  readonly after: CanonicalDocument;
};

/**
 * CW5-07 — canonical tour write-path publish gate via tour-core neutral label mapping.
 * Strangler: lifecycle assertion unchanged; label interpretation uses tour-core ports (CW5-04).
 */
export function assertCanonicalTourWritePublishGate(
  input: CanonicalTourWritePublishGateInput,
): void {
  assertTourPublishLifecycleOnUpdate(input);
}

export type { TourPublishVisibilityBucket };
