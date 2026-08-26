/** AP15 P3 — bounded workspace settings catalog list reads. */
export const MAX_SETTINGS_CATALOG = 500;

export const EQUIPMENT_LIST_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  category: true,
  iconKey: true,
  themeIds: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const TOUR_THEME_LIST_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  slug: true,
  formProfile: true,
  iconKey: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const GUIDE_LANGUAGE_LIST_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  slug: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const TOUR_PRESET_LIST_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  description: true,
  themeId: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const REGION_LIST_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  country: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const DESTINATION_LIST_SELECT = {
  id: true,
  tenantId: true,
  regionId: true,
  name: true,
  locationType: true,
  altitudeM: true,
  typicalTrailDistanceKm: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;
