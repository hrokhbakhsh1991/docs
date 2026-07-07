import { getTranslations } from "next-intl/server";

import { HOME_TESTIMONIAL_IDS } from "./home-testimonial-ids";

export async function HomeTestimonials() {
  const t = await getTranslations("catalog");

  return (
    <section data-marketing-home-testimonials>
      <header>
        <h2>{t("home.full.testimonials.title")}</h2>
      </header>
      <div data-marketing-home-testimonials-row>
        {HOME_TESTIMONIAL_IDS.map((id, index) => (
          <figure
            key={id}
            data-marketing-home-testimonial-card
            {...(index === 0 ? { "data-marketing-home-testimonial-card-featured": true } : {})}
          >
            <blockquote>
              <p>{t(`home.full.testimonials.${id}.quote`)}</p>
            </blockquote>
            <figcaption>
              <span data-marketing-home-testimonial-name>
                {t(`home.full.testimonials.${id}.name`)}
              </span>
              <span data-marketing-home-testimonial-role>
                {t(`home.full.testimonials.${id}.role`)}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
