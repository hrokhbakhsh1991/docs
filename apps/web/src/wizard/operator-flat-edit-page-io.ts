import type { UpdateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";

import type { UpdateTourActionResult } from "@/tours/update-tour.server";

/** Shell-local load-result shape — mirrors flat-edit chrome binder (no branded type name). */
export type OperatorFlatEditTourLoadResult =
  | {
      readonly ok: true;
      readonly detail: {
        readonly projection: {
          readonly title: string;
          readonly uiStatus: string;
          readonly priceAmount: number | null;
          readonly priceCurrency: string | null;
          readonly departureAt: string | null;
          readonly acceptedSeats: number;
          readonly capacity: number | null;
        };
      };
      readonly baseline: unknown;
      readonly rowVersion: number;
    }
  | { readonly ok: false; readonly kind: "not-found" | "error"; readonly code: string };

/**
 * Shell I/O contract for operator flat-edit orchestration (P2-D4.a).
 * Keeps `/api/…` and server actions out of future package surfaces.
 */
export type OperatorFlatEditPageIo = {
  readonly loadWizardTemplatePayload: () => Promise<unknown | null>;
  readonly loadTourBaseline: (input: {
    readonly tourId: string;
    readonly plugin: WorkspacePlugin;
  }) => Promise<OperatorFlatEditTourLoadResult>;
  readonly updateTour: (
    tourId: string,
    payload: UpdateTourPayload
  ) => Promise<UpdateTourActionResult>;
};
