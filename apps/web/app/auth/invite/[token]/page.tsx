import { redirect } from "next/navigation";

type InvitePageProps = {
  params: { token: string };
};

export default function InviteEntryPage({ params }: InvitePageProps) {
  const token = params.token?.trim();
  if (!token) {
    redirect("/auth/login");
  }
  redirect(`/auth/login?invite=${encodeURIComponent(token)}`);
}
