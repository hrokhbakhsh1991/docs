import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { UserDetailChunkLoading } from "../user-detail-chunk-loading";
import { USERS_ROUTE_COPY } from "../users-copy";

const UserDetailClient = dynamic(
  () => import("./user-detail-client").then((m) => m.UserDetailClient),
  { loading: () => <UserDetailChunkLoading /> }
);

export const metadata: Metadata = {
  title: USERS_ROUTE_COPY.metadata.detailTitle,
  description: USERS_ROUTE_COPY.metadata.detailDescription,
};

export default function UserDetailPage({ params }: { params: { id: string } }) {
  return <UserDetailClient userId={params.id} />;
}
