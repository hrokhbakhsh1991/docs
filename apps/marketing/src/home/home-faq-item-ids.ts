/** Stable FAQ item ids — i18n keys home.full.faq.{id}.question|answer */
export const HOME_FAQ_ITEM_IDS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

export type HomeFaqItemId = (typeof HOME_FAQ_ITEM_IDS)[number];
