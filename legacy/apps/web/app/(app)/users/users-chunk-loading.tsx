import { Card, CardBody, LoadingState } from "@tour/ui";

import { USERS_ROUTE_COPY } from "./users-copy";

/** Shown while the dynamic `UsersPageClient` chunk loads (same design language as in-app loading). */
export function UsersChunkLoading() {
  return (
    <Card>
      <CardBody>
        <LoadingState message={USERS_ROUTE_COPY.list.loadingMembers} />
      </CardBody>
    </Card>
  );
}
