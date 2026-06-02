/**
 * Classifies persisted / wizard ids so tour clone preserves workspace catalog FKs
 * and only remints tour-scoped instance ids (media, gathering rows, etc.).
 */

/** Workspace catalog FK — must survive clone unchanged. */
export type GlobalCatalogReferenceKey =
  | "themeId"
  | "leaderId"
  | "destinationId"
  | "gearItemId";

/** Tour-owned row id — must be reminted on clone. */
export type TourInstanceReferenceKey = "mediaId" | "gatheringPointId" | "locationInstanceId";

export type CatalogReferenceKey = GlobalCatalogReferenceKey | TourInstanceReferenceKey;

const GLOBAL_CATALOG_REFERENCES: ReadonlySet<GlobalCatalogReferenceKey> = new Set([
  "themeId",
  "leaderId",
  "destinationId",
  "gearItemId",
]);

const TOUR_INSTANCE_REFERENCES: ReadonlySet<TourInstanceReferenceKey> = new Set([
  "mediaId",
  "gatheringPointId",
  "locationInstanceId",
]);

/** Array field names whose elements are {@link GlobalCatalogReferenceKey} values. */
export const GLOBAL_CATALOG_ARRAY_FIELD_NAMES: ReadonlySet<string> = new Set([
  "tourThemeIds",
  "themeIds",
  "leaderUserIds",
  "gearRequiredIds",
  "gearOptionalIds",
]);

/**
 * Overview map pin containers whose optional `id` is a tour-scoped location instance
 * (must be reminted on clone — not workspace catalog).
 */
export const OVERVIEW_TOUR_INSTANCE_PIN_FIELD_NAMES: ReadonlySet<string> = new Set([
  "startPoint",
  "summitPoint",
  "campPoint",
  "endPoint",
]);

export type CatalogRegistryResolveInput = {
  /** Property being written (`id` on an object, or synthetic `[]` for array elements). */
  propertyName: string;
  /** Dot/bracket path to the parent container (e.g. `photos[0]`, `overview`). */
  parentPath: string;
  /** Immediate array field name when cloning catalog id lists. */
  containerField?: string;
};

export class CatalogRegistry {
  static readonly globalCatalogReferences: ReadonlySet<GlobalCatalogReferenceKey> =
    GLOBAL_CATALOG_REFERENCES;

  static readonly tourInstanceReferences: ReadonlySet<TourInstanceReferenceKey> =
    TOUR_INSTANCE_REFERENCES;

  isGlobalCatalogReference(key: CatalogReferenceKey): key is GlobalCatalogReferenceKey {
    return GLOBAL_CATALOG_REFERENCES.has(key as GlobalCatalogReferenceKey);
  }

  isTourInstanceReference(key: CatalogReferenceKey): key is TourInstanceReferenceKey {
    return TOUR_INSTANCE_REFERENCES.has(key as TourInstanceReferenceKey);
  }

  /** Clone must remint only tour-instance references. */
  shouldRemintOnClone(key: CatalogReferenceKey): boolean {
    return this.isTourInstanceReference(key);
  }

  resolveReferenceKey(input: CatalogRegistryResolveInput): CatalogReferenceKey | null {
    const containerField = input.containerField?.trim();
    if (containerField && GLOBAL_CATALOG_ARRAY_FIELD_NAMES.has(containerField)) {
      if (containerField === "tourThemeIds" || containerField === "themeIds") {
        return "themeId";
      }
      if (containerField === "leaderUserIds") {
        return "leaderId";
      }
      if (containerField === "gearRequiredIds" || containerField === "gearOptionalIds") {
        return "gearItemId";
      }
    }

    if (input.propertyName === "destinationId") {
      return "destinationId";
    }

    if (input.propertyName !== "id") {
      return null;
    }

    const path = input.parentPath;

    if (this.isPhotoContainerPath(path)) {
      return "mediaId";
    }

    if (/\.gatheringPoints(?:\[\d+\]|\.\d+)$/.test(path)) {
      return "gatheringPointId";
    }

    if (/\.gatheringPoints(?:\[\d+\]|\.\d+)\.location$/.test(path)) {
      return "locationInstanceId";
    }

    if (this.isOverviewTourInstancePinPath(path)) {
      return "locationInstanceId";
    }

    return null;
  }

  private isOverviewTourInstancePinPath(parentPath: string): boolean {
    const match = /^overview\.([^.[\]]+)$/.exec(parentPath);
    if (!match) {
      return false;
    }
    return OVERVIEW_TOUR_INSTANCE_PIN_FIELD_NAMES.has(match[1]!);
  }

  private isPhotoContainerPath(parentPath: string): boolean {
    return (
      /^photos\[\d+\]$/.test(parentPath) ||
      /\.photos\[\d+\]$/.test(parentPath) ||
      /\.photos\.\d+$/.test(parentPath) ||
      parentPath === "photos" ||
      parentPath.endsWith(".photos")
    );
  }
}

export const catalogRegistry = new CatalogRegistry();
