import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function OperatorNotFound() {
  const t = await getTranslations("common");

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("notFoundDescription")}</p>
      <Link className="text-primary underline underline-offset-4" href="/dashboard">
        {t("backToDashboard")}
      </Link>
    </main>
  );
}
