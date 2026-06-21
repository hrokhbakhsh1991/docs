import { parseLocationsResponse } from "./catalog-parse";
import type { UsersListResponse } from "./catalog-types";
import type { DenaliReviewCatalog } from "../logic/denali-review-format-logic";

function readNameMap(
  items: readonly { readonly id: string; readonly name: string }[]
): ReadonlyMap<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

export async function loadDenaliReviewCatalog(): Promise<DenaliReviewCatalog> {
  const [locationsRes, usersRes, themesRes, languagesRes] = await Promise.all([
    fetch("/api/settings/resources/locations", { cache: "no-store" }),
    fetch("/api/users?role=all&status=active", { cache: "no-store" }),
    fetch("/api/settings/resources/tour_themes", { cache: "no-store" }),
    fetch("/api/settings/resources/guide_languages", { cache: "no-store" }),
  ]);

  const destinationNameById = new Map<string, string>();
  if (locationsRes.ok) {
    const payload = parseLocationsResponse(await locationsRes.json());
    for (const destination of payload.destinations) {
      destinationNameById.set(destination.id, destination.name);
    }
  }

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

  return {
    destinationNameById,
    leaderNameById,
    themeNameById,
    languageNameById,
  };
}
