import {
  TourWorkspaceLegacyTabRedirect,
} from "@/features/tours/tour-workspace-legacy-tab-redirect";

type TourWorkspaceTransportRedirectProps = {
  readonly params: Promise<{ id: string }>;
};

/** Legacy segment — canonical tab is `?tab=transport`. */
export default async function TourWorkspaceTransportRedirectPage({
  params,
}: TourWorkspaceTransportRedirectProps) {
  const { id } = await params;
  return <TourWorkspaceLegacyTabRedirect tourId={id} tab="transport" />;
}
