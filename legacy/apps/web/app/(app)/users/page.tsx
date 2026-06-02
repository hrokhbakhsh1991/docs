import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { UsersChunkLoading } from "./users-chunk-loading";
import { USERS_ROUTE_COPY } from "./users-copy";

const UsersPageClient = dynamic(
  () => import("./users-page-client").then((m) => m.UsersPageClient),
  { loading: () => <UsersChunkLoading /> }
);

export const metadata: Metadata = {
  title: USERS_ROUTE_COPY.metadata.listTitle,
  description: USERS_ROUTE_COPY.metadata.listDescription,
};

export default function UsersPage() {
  return <UsersPageClient />;
}
