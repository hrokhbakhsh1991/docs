/** Loose typing for the BFF passthrough on clone/duplicate paths. */
export type TourCloneSourceDto = {
  title?: string | null;
  description?: string | null;
  tourType?: string | null;
  chatLink?: string | null;
  communicationLink?: string | null;
  autoAcceptRegistrations?: boolean | null;
  transportModes?: unknown;
  transport_modes?: unknown;
  destinationId?: string | null;
  costContext?: Record<string, unknown> | null;
  formProfileSnapshot?: string | null;
  lifecycleStatus?: string | null;
  details?:
    | {
        tripDetails?: Record<string, unknown> | null;
      }
    | null;
};
