import { redirect } from "next/navigation";

type PlatformWorkspaceVersionRedirectProps = {
  readonly params: Promise<{ readonly id: string; readonly version: string }>;
};

/** Open the builder with an explicit version query. */
export default async function PlatformWorkspaceVersionRedirectPage({
  params,
}: PlatformWorkspaceVersionRedirectProps) {
  const { id, version } = await params;
  const parsed = Number.parseInt(version, 10);
  const query =
    Number.isFinite(parsed) && parsed > 0
      ? `?version=${encodeURIComponent(String(parsed))}`
      : "";
  redirect(`/platform/workspace-definitions/${encodeURIComponent(id)}${query}`);
}
