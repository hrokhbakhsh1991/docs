import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function OperatorNotFound() {
  const t = await getTranslations("common.pageNotFound");

  return (
    <main
      data-web-page-not-found
      className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <div data-web-not-found>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
        <Link className="text-primary underline underline-offset-4" href="/">
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
