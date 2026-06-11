import type { UrbanSettingsPatchBody } from "./schemas/urban-settings-patch.schema";

const DEFAULT_URBAN_CATALOG = { publicEnabled: true, slug: "catalog" } as const;
const DEFAULT_URBAN_REGISTRATION = { policy: "open" as const, requirePhone: false };
const DEFAULT_URBAN = {
  catalog: DEFAULT_URBAN_CATALOG,
  registration: DEFAULT_URBAN_REGISTRATION,
} as const;

export type UrbanSettingsUrban = {
  readonly catalog: {
    readonly publicEnabled: boolean;
    readonly slug: string;
  };
  readonly registration: {
    readonly policy: "open" | "waitlist" | "closed";
    readonly requirePhone?: boolean;
    readonly confirmationMessage?: string;
  };
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeUrbanSubtree(
  existingUrban: unknown,
  patchUrban: UrbanSettingsPatchBody["urban"]
): UrbanSettingsUrban {
  const base: Record<string, unknown> = isPlainObject(existingUrban)
    ? cloneJson(existingUrban)
    : cloneJson(DEFAULT_URBAN);

  const catalogBase: Record<string, unknown> = isPlainObject(base.catalog)
    ? { ...base.catalog }
    : cloneJson(DEFAULT_URBAN_CATALOG);
  catalogBase.publicEnabled = patchUrban.catalog.publicEnabled;
  catalogBase.slug = patchUrban.catalog.slug;
  base.catalog = catalogBase;

  const regBase: Record<string, unknown> = isPlainObject(base.registration)
    ? { ...base.registration }
    : cloneJson(DEFAULT_URBAN_REGISTRATION);
  regBase.policy = patchUrban.registration.policy;
  if ("requirePhone" in patchUrban.registration) {
    regBase.requirePhone = patchUrban.registration.requirePhone;
  } else if (!("requirePhone" in regBase)) {
    regBase.requirePhone = DEFAULT_URBAN_REGISTRATION.requirePhone;
  }
  if ("confirmationMessage" in patchUrban.registration) {
    regBase.confirmationMessage = patchUrban.registration.confirmationMessage;
  } else {
    delete regBase.confirmationMessage;
  }
  base.registration = regBase;

  return base as UrbanSettingsUrban;
}

export function patchThemeUrban(
  existingTheme: unknown,
  patchBody: UrbanSettingsPatchBody
): Record<string, unknown> {
  const mergedTheme: Record<string, unknown> = isPlainObject(existingTheme)
    ? cloneJson(existingTheme)
    : {};
  mergedTheme.urban = mergeUrbanSubtree(
    isPlainObject(existingTheme) ? existingTheme.urban : null,
    patchBody.urban
  );
  return mergedTheme;
}

export function normalizeUrbanSubtree(existingUrban: unknown): UrbanSettingsUrban {
  const base = isPlainObject(existingUrban) ? cloneJson(existingUrban) : cloneJson(DEFAULT_URBAN);
  const catalogRaw = isPlainObject(base.catalog) ? base.catalog : cloneJson(DEFAULT_URBAN_CATALOG);
  const catalog = {
    publicEnabled:
      typeof catalogRaw.publicEnabled === "boolean"
        ? catalogRaw.publicEnabled
        : DEFAULT_URBAN_CATALOG.publicEnabled,
    slug: typeof catalogRaw.slug === "string" ? catalogRaw.slug : DEFAULT_URBAN_CATALOG.slug,
  };
  const registrationRaw: Record<string, unknown> = isPlainObject(base.registration)
    ? base.registration
    : cloneJson(DEFAULT_URBAN_REGISTRATION);
  const policy =
    registrationRaw.policy === "open" ||
    registrationRaw.policy === "waitlist" ||
    registrationRaw.policy === "closed"
      ? registrationRaw.policy
      : DEFAULT_URBAN_REGISTRATION.policy;
  const registration: UrbanSettingsUrban["registration"] = {
    policy,
    requirePhone:
      typeof registrationRaw.requirePhone === "boolean"
        ? registrationRaw.requirePhone
        : DEFAULT_URBAN_REGISTRATION.requirePhone,
    ...(typeof registrationRaw.confirmationMessage === "string"
      ? { confirmationMessage: registrationRaw.confirmationMessage }
      : {}),
  };
  return { catalog, registration };
}

export function readUrbanFromTheme(theme: unknown): UrbanSettingsUrban {
  if (isPlainObject(theme) && isPlainObject(theme.urban)) {
    return normalizeUrbanSubtree(theme.urban);
  }
  return cloneJson(DEFAULT_URBAN);
}
