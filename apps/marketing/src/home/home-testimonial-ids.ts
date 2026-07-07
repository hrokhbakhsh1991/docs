/** Testimonial ids — i18n home.full.testimonials.{id}.quote|name|role */
export const HOME_TESTIMONIAL_IDS = ["t1", "t2", "t3"] as const;

export type HomeTestimonialId = (typeof HOME_TESTIMONIAL_IDS)[number];
