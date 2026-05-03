import type { Metadata } from "next";
import dynamic from "next/dynamic";

const UserDetailClient = dynamic(
  () => import("./user-detail-client").then((m) => m.UserDetailClient),
  { loading: () => <p>Loading user…</p> }
);

export const metadata: Metadata = {
  title: "User",
  description: "Workspace user profile.",
};

export default function UserDetailPage({ params }: { params: { id: string } }) {
  return <UserDetailClient userId={params.id} />;
}
