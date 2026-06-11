import { redirect } from "next/navigation";

import { buildInviteLoginRedirect } from "@/features/users/invite-accept-logic";

type InvitePageProps = {
  readonly params: Promise<{ readonly token: string }>;
};

export default async function InviteEntryPage({ params }: InvitePageProps) {
  const { token } = await params;
  redirect(buildInviteLoginRedirect(token));
}
