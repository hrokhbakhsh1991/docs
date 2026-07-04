/** Equipment checklist ids — i18n home.full.equipment.{id}.label */
export const HOME_EQUIPMENT_ITEM_IDS = ["boots", "layers", "pack", "headlamp"] as const;

export type HomeEquipmentItemId = (typeof HOME_EQUIPMENT_ITEM_IDS)[number];
