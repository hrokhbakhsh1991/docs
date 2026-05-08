import { Card, CardBody, LoadingState } from "@tour/ui";

import { USERS_ROUTE_COPY } from "./users-copy";

/** Shown while the dynamic `UserDetailClient` chunk loads (matches list chunk pattern). */
export function UserDetailChunkLoading() {
  return (
    <Card>
      <CardBody>
        <LoadingState message={USERS_ROUTE_COPY.detail.loadingProfile} />
      </CardBody>
    </Card>
  );
}
