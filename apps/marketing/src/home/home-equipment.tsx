import { getTranslations } from "next-intl/server";

import { HOME_EQUIPMENT_ITEM_IDS } from "./home-equipment-item-ids";

export async function HomeEquipment() {
  const t = await getTranslations("catalog");

  return (
    <section data-marketing-home-equipment>
      <header>
        <h2>{t("home.full.equipment.title")}</h2>
        <p>{t("home.full.equipment.lead")}</p>
      </header>
      <ul data-marketing-home-equipment-list>
        {HOME_EQUIPMENT_ITEM_IDS.map((id) => (
          <li key={id} data-marketing-home-equipment-item>
            {t(`home.full.equipment.${id}.label`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
