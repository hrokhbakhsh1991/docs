export const PROFILE_GENDER_VALUES = ["female", "male", "non_binary", "prefer_not_to_say"] as const;

export type ProfileGenderValue = (typeof PROFILE_GENDER_VALUES)[number];
