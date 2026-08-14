import type { UsersListResponse } from "./catalog-types";
import type { DenaliReviewCatalog } from "../logic/denali-review-format-logic";

function readNameMap(
  items: readonly { readonly id: string; readonly name: string }[]
): ReadonlyMap<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

export async function loadDenaliReviewCatalog(): Promise<DenaliReviewCatalog> {
  const [usersRes, themesRes, languagesRes, equipmentRes] = await Promise.all([
    fetch("/api/users?role=all&status=active", { cache: "no-store" }),
    fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
    fetch("/api/settings/resources/guide_languages", { cache: "no-store" }),
    fetch("/api/settings/resources/equipment", { cache: "no-store" }),
  ]);

  const leaderNameById = new Map<string, string>();
  if (usersRes.ok) {
    const payload = (await usersRes.json()) as UsersListResponse;
    for (const user of payload.items ?? []) {
      leaderNameById.set(user.userId, user.displayName);
    }
  }

  let themeNameById: ReadonlyMap<string, string> = new Map();
  if (themesRes.ok) {
    const payload = (await themesRes.json()) as {
      items?: Array<{ id: string; name: string }>;
    };
    themeNameById = readNameMap(
      (payload.items ?? []).map((item) => ({ id: item.id, name: item.name }))
    );
  }

  let languageNameById: ReadonlyMap<string, string> = new Map();
  if (languagesRes.ok) {
    const payload = (await languagesRes.json()) as {
      items?: Array<{ id: string; name: string }>;
    };
    languageNameById = readNameMap(
      (payload.items ?? []).map((item) => ({ id: item.id, name: item.name }))
    );
  }

  let equipmentIconKeyById: ReadonlyMap<string, string | null> = new Map();
  if (equipmentRes.ok) {
    const payload = (await equipmentRes.json()) as {
      items?: Array<{ id: string; iconKey?: string | null }>;
    };
    equipmentIconKeyById = new Map(
      (payload.items ?? []).map((item) => [item.id, item.iconKey ?? null] as const)
    );
  }

  return {
    destinationNameById: new Map(),
    leaderNameById,
    themeNameById,
    languageNameById,
    equipmentIconKeyById,
  };
}
