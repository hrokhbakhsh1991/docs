import { getLocale, getTranslations } from "next-intl/server";

import { HOME_EQUIPMENT_ITEM_IDS } from "./home-equipment-item-ids";
import { HOME_FAQ_ITEM_IDS } from "./home-faq-item-ids";

function equipmentAnswer(
  t: (key: string) => string,
  locale: string
): string {
  const lead = t("home.full.equipment.lead");
  const labels = HOME_EQUIPMENT_ITEM_IDS.map((id) => t(`home.full.equipment.${id}.label`));
  const separator = locale === "fa" ? "، " : "; ";
  return `${lead} ${labels.join(separator)}.`;
}

export async function HomeFaq() {
  const t = await getTranslations("catalog");
  const locale = await getLocale();

  return (
    <section data-marketing-home-faq data-marketing-home-faq-document id="faq">
      <div data-marketing-home-faq-inner>
        <header>
          <h2>{t("home.full.faq.title")}</h2>
        </header>
        <div data-marketing-home-faq-list>
          {HOME_FAQ_ITEM_IDS.map((id) => (
            <details key={id} data-marketing-home-faq-item>
              <summary data-marketing-home-faq-question>
                {t(`home.full.faq.${id}.question`)}
              </summary>
              {id === "q2" ? (
                <p
                  data-marketing-home-faq-answer
                  data-marketing-home-faq-answer-equipment
                >
                  {equipmentAnswer((key) => t(key), locale)}
                </p>
              ) : (
                <p data-marketing-home-faq-answer>{t(`home.full.faq.${id}.answer`)}</p>
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
