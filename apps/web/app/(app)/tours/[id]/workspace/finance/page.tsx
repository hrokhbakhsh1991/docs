import {
  TourWorkspaceLegacyTabRedirect,
} from "@/features/tours/tour-workspace-legacy-tab-redirect";

type TourWorkspaceFinanceRedirectProps = {
  readonly params: Promise<{ id: string }>;
};

/** Legacy segment — canonical tab is `?tab=finance`. */
export default async function TourWorkspaceFinanceRedirectPage({
  params,
}: TourWorkspaceFinanceRedirectProps) {
  const { id } = await params;
  return <TourWorkspaceLegacyTabRedirect tourId={id} tab="finance" />;
}
