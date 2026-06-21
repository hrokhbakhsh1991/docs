import {
  aggregateDenaliSubmitCatalogIds,
  DENALI_SUBMIT_CATALOG_BFF_PATHS,
  type DenaliSubmitCatalogIds,
} from "../../wizard/denali-wizard-catalog-sanitize";
import { parseLocationsResponse } from "../adapters/catalog-parse";
import type { UsersListResponse } from "../adapters/catalog-types";

export {
  aggregateDenaliSubmitCatalogIds,
  DENALI_SUBMIT_CATALOG_BFF_PATHS,
  type DenaliSubmitCatalogIds,
};

/** Phase 15.2 P15-W-B1d / P15-W-C1 — web fetch adapter; aggregation lives in workspace-denali. */
export async function loadDenaliSubmitCatalogIds(): Promise<DenaliSubmitCatalogIds> {
  try {
    const paths = DENALI_SUBMIT_CATALOG_BFF_PATHS;
    const [equipmentResponse, themesResponse, guideLanguagesResponse, locationsResponse, usersResponse] =
      await Promise.all([
        fetch(paths.equipment, { cache: "no-store" }),
        fetch(paths.tourThemes, { cache: "no-store" }),
        fetch(paths.guideLanguages, { cache: "no-store" }),
        fetch(paths.locations, { cache: "no-store" }),
        fetch(paths.activeUsers, { cache: "no-store" }),
      ]);

    const aggregateInput: {
      equipmentItems?: Array<{ id: string; isActive?: boolean }>;
      themeItems?: Array<{ id: string; isActive?: boolean }>;
      guideLanguageItems?: Array<{ id: string; isActive?: boolean }>;
      destinationItems?: Array<{ id: string; name: string; isActive?: boolean }>;
      userItems?: UsersListResponse["items"];
    } = {};

    if (equipmentResponse.ok) {
      const equipmentPayload = (await equipmentResponse.json()) as {
        items?: Array<{ id: string; isActive?: boolean }>;
      };
      aggregateInput.equipmentItems = equipmentPayload.items ?? [];
    }
    if (themesResponse.ok) {
      const themesPayload = (await themesResponse.json()) as {
        items?: Array<{ id: string; isActive?: boolean }>;
      };
      aggregateInput.themeItems = themesPayload.items ?? [];
    }
    if (guideLanguagesResponse.ok) {
      const guideLanguagesPayload = (await guideLanguagesResponse.json()) as {
        items?: Array<{ id: string; isActive?: boolean }>;
      };
      aggregateInput.guideLanguageItems = guideLanguagesPayload.items ?? [];
    }
    if (locationsResponse.ok) {
      const locationsPayload = parseLocationsResponse(await locationsResponse.json());
      aggregateInput.destinationItems = [...locationsPayload.destinations];
    }
    if (usersResponse.ok) {
      const usersPayload = (await usersResponse.json()) as UsersListResponse;
      aggregateInput.userItems = usersPayload.items ?? [];
    }

    return aggregateDenaliSubmitCatalogIds(aggregateInput);
  } catch {
    return {};
  }
}
