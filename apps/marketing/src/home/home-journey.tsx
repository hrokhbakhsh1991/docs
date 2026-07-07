import { ClipboardList, Flag, Mountain, Package } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import { isAppLocale, type AppLocale } from "@/i18n/routing";

import { HOME_JOURNEY_STEP_IDS, type HomeJourneyStepId } from "./home-journey-step-ids";

const JOURNEY_STEP_ICONS: Record<HomeJourneyStepId, typeof ClipboardList> = {
  register: ClipboardList,
  prepare: Package,
  summit: Mountain,
  return: Flag,
};

export async function HomeJourney() {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";

  return (
    <section data-marketing-home-journey>
      <header>
        <h2>{t("home.full.journey.title")}</h2>
        <p>{t("home.full.journey.lead")}</p>
      </header>
      <ol data-marketing-home-journey-steps>
        {HOME_JOURNEY_STEP_IDS.map((id, index) => {
          const Icon = JOURNEY_STEP_ICONS[id];
          const stepLabel = formatLocalizedNumber(index + 1, locale, {
            minimumIntegerDigits: 2,
          });
          return (
            <li key={id} data-marketing-home-journey-step>
              <span data-marketing-home-journey-step-index aria-hidden="true">
                {stepLabel}
              </span>
              <Icon aria-hidden="true" data-marketing-home-journey-step-icon />
              <h3>{t(`home.full.journey.${id}.title`)}</h3>
              <p>{t(`home.full.journey.${id}.description`)}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
