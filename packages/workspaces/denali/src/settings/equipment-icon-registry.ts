export const EQUIPMENT_ICON_CATEGORIES = [
  "hiking",
  "camp",
  "clothing",
  "safety",
  "food_water",
  "general",
] as const;

export type EquipmentIconCategory = (typeof EQUIPMENT_ICON_CATEGORIES)[number];

export const EQUIPMENT_ICON_KEYS = [
  "backpack",
  "trekking_poles",
  "boot",
  "mountain",
  "map",
  "compass",
  "tent",
  "sleeping_bag",
  "flashlight",
  "gloves",
  "jacket",
  "glasses",
  "helmet",
  "first_aid",
  "life_buoy",
  "water_bottle",
  "utensils",
  "rope",
  "tool",
  "camera",
  "umbrella",
  "sun",
] as const;

export type EquipmentIconKey = (typeof EQUIPMENT_ICON_KEYS)[number];

export type EquipmentIconRegistryEntry = {
  readonly key: EquipmentIconKey;
  readonly category: EquipmentIconCategory;
  readonly labelKey: string;
  readonly keywords: readonly string[];
};

export const EQUIPMENT_ICON_REGISTRY: readonly EquipmentIconRegistryEntry[] = Object.freeze([
  { key: "backpack", category: "hiking", labelKey: "composites.gear.icons.backpack", keywords: ["backpack", "کوله", "کیف"] },
  {
    key: "trekking_poles",
    category: "hiking",
    labelKey: "composites.gear.icons.trekking_poles",
    keywords: ["pole", "poles", "trekking", "باتوم", "عصا", "walking stick"],
  },
  { key: "boot", category: "hiking", labelKey: "composites.gear.icons.boot", keywords: ["boot", "boots", "کفش", "نیم‌بوت"] },
  { key: "mountain", category: "hiking", labelKey: "composites.gear.icons.mountain", keywords: ["mountain", "کوه", "summit"] },
  { key: "map", category: "hiking", labelKey: "composites.gear.icons.map", keywords: ["map", "نقشه"] },
  { key: "compass", category: "hiking", labelKey: "composites.gear.icons.compass", keywords: ["compass", "قطب‌نما"] },
  { key: "tent", category: "camp", labelKey: "composites.gear.icons.tent", keywords: ["tent", "چادر"] },
  {
    key: "sleeping_bag",
    category: "camp",
    labelKey: "composites.gear.icons.sleeping_bag",
    keywords: ["sleeping bag", "sleeping", "کیسه خواب", "خواب"],
  },
  { key: "flashlight", category: "camp", labelKey: "composites.gear.icons.flashlight", keywords: ["flashlight", "torch", "چراغ", "هدلایت"] },
  { key: "gloves", category: "clothing", labelKey: "composites.gear.icons.gloves", keywords: ["glove", "gloves", "دستکش"] },
  { key: "jacket", category: "clothing", labelKey: "composites.gear.icons.jacket", keywords: ["jacket", "coat", "کاپشن", "ژاکت"] },
  { key: "glasses", category: "clothing", labelKey: "composites.gear.icons.glasses", keywords: ["glasses", "عینک", "sunglasses"] },
  { key: "helmet", category: "safety", labelKey: "composites.gear.icons.helmet", keywords: ["helmet", "کلاه ایمنی", "کلاه کاسکت"] },
  {
    key: "first_aid",
    category: "safety",
    labelKey: "composites.gear.icons.first_aid",
    keywords: ["first aid", "aid kit", "کمک‌های اولیه", "پزشکی"],
  },
  { key: "life_buoy", category: "safety", labelKey: "composites.gear.icons.life_buoy", keywords: ["life buoy", "life jacket", "جلیقه"] },
  {
    key: "water_bottle",
    category: "food_water",
    labelKey: "composites.gear.icons.water_bottle",
    keywords: ["water", "bottle", "قمق", "بطری", "فلاکس"],
  },
  { key: "utensils", category: "food_water", labelKey: "composites.gear.icons.utensils", keywords: ["utensil", "spoon", "قاشق", "غذا"] },
  { key: "rope", category: "general", labelKey: "composites.gear.icons.rope", keywords: ["rope", "طناب", "cord"] },
  { key: "tool", category: "general", labelKey: "composites.gear.icons.tool", keywords: ["tool", "ابزار", "multi"] },
  { key: "camera", category: "general", labelKey: "composites.gear.icons.camera", keywords: ["camera", "دوربین"] },
  { key: "umbrella", category: "general", labelKey: "composites.gear.icons.umbrella", keywords: ["umbrella", "چتر"] },
  { key: "sun", category: "general", labelKey: "composites.gear.icons.sun", keywords: ["sun", "sunscreen", "ضد آفتاب", "کرم"] },
]);

const ICON_KEY_SET = new Set<string>(EQUIPMENT_ICON_KEYS);

export function isKnownEquipmentIconKey(value: string): value is EquipmentIconKey {
  return ICON_KEY_SET.has(value);
}

export function listEquipmentIconsByCategory(
  category: EquipmentIconCategory
): readonly EquipmentIconRegistryEntry[] {
  return EQUIPMENT_ICON_REGISTRY.filter((entry) => entry.category === category);
}

export function suggestEquipmentIconKey(name: string): EquipmentIconKey | null {
  const normalized = name.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  for (const entry of EQUIPMENT_ICON_REGISTRY) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return entry.key;
    }
  }
  return null;
}
