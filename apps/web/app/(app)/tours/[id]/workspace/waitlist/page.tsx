import {
  TourWorkspaceLegacyTabRedirect,
} from "@/features/tours/tour-workspace-legacy-tab-redirect";

type TourWorkspaceWaitlistRedirectProps = {
  readonly params: Promise<{ id: string }>;
};

/** Legacy segment — canonical tab is `?tab=waitlist`. */
export default async function TourWorkspaceWaitlistRedirectPage({
  params,
}: TourWorkspaceWaitlistRedirectProps) {
  const { id } = await params;
  return <TourWorkspaceLegacyTabRedirect tourId={id} tab="waitlist" />;
}
