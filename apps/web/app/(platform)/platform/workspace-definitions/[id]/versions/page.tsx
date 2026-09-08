import { redirect } from "next/navigation";

type PlatformWorkspaceVersionsRedirectProps = {
  readonly params: Promise<{ readonly id: string }>;
};

/** Canonical builder lives on `/platform/workspace-definitions/:id`. */
export default async function PlatformWorkspaceVersionsRedirectPage({
  params,
}: PlatformWorkspaceVersionsRedirectProps) {
  const { id } = await params;
  redirect(`/platform/workspace-definitions/${encodeURIComponent(id)}`);
}
