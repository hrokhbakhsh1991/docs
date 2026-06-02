import { Card, CardBody, LoadingState } from "@tour/ui";

/**
 * Shown while the client chunk for `TourCreateWizardWrapper` loads.
 * Keeps `useSearchParams()` usage out of the Server Component tree without
 * leaving the route stuck on the segment `loading.tsx` fallback.
 */
export function TourCreateWizardChunkLoading() {
  return (
    <Card>
      <CardBody>
        <LoadingState message="در حال بارگذاری ویزارد…" />
      </CardBody>
    </Card>
  );
}
