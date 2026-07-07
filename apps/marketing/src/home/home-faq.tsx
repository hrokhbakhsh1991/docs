import { getTranslations } from "next-intl/server";

import { HOME_FAQ_ITEM_IDS } from "./home-faq-item-ids";

export async function HomeFaq() {
  const t = await getTranslations("catalog");

  return (
    <section data-marketing-home-faq id="faq">
      <header>
        <h2>{t("home.full.faq.title")}</h2>
      </header>
      <div data-marketing-home-faq-list>
        {HOME_FAQ_ITEM_IDS.map((id) => (
          <details key={id} data-marketing-home-faq-item>
            <summary data-marketing-home-faq-question>
              {t(`home.full.faq.${id}.question`)}
            </summary>
            <p data-marketing-home-faq-answer>{t(`home.full.faq.${id}.answer`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
