import {
  TourWorkspaceRegistrationsAliasRedirect,
} from "@/features/tours/tour-workspace-legacy-tab-redirect";

type TourWorkspaceRegistrationsAliasPageProps = {
  readonly params: Promise<{ id: string }>;
};

/** Alias — registrations tab lives at `/tours/[id]/workspace` (TR-02). */
export default async function TourWorkspaceRegistrationsAliasPage({
  params,
}: TourWorkspaceRegistrationsAliasPageProps) {
  const { id } = await params;
  return <TourWorkspaceRegistrationsAliasRedirect tourId={id} />;
}
