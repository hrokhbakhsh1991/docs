import { redirect } from "@/i18n/navigation";

import { routing } from "@/i18n/routing";

type InvitePageProps = {
  params: { token: string };
};

export default function InviteEntryPage({ params }: InvitePageProps) {
  const token = params.token?.trim();
  if (!token) {
    redirect({ href: "/auth/login", locale: routing.defaultLocale });
  }
  redirect({
    href: `/auth/login?invite=${encodeURIComponent(token)}`,
    locale: routing.defaultLocale,
  });
}
