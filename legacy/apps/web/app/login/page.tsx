import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

import { LoginForm } from "../auth/login/login-form";

const LOCALE = routing.defaultLocale;

export async function generateMetadata() {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "metadata.login" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LoginPage() {
  setRequestLocale(LOCALE);

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
