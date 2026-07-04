import { getTranslations } from "next-intl/server";

/** Stub until CMS/blog route exists — manifest `blogTeaser` gates render (PR-8). */
export async function HomeBlogTeaser() {
  const t = await getTranslations("catalog");

  return (
    <section data-marketing-home-blog>
      <header>
        <h2>{t("home.full.blog.title")}</h2>
        <p>{t("home.full.blog.lead")}</p>
      </header>
      <p data-marketing-home-blog-stub>{t("home.full.blog.stub")}</p>
    </section>
  );
}
