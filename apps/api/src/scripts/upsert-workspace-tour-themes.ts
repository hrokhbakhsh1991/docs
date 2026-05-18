import type { TourFormProfile } from "@repo/types";
import type { Repository } from "typeorm";

import { WorkspaceTourThemeEntity } from "../modules/settings-locations/entities/workspace-tour-theme.entity";
import { emitScriptInfo } from "./script-log";

export type WorkspaceTourThemeSeed = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  formProfile: TourFormProfile;
};

export async function upsertWorkspaceTourThemes(
  themeRepo: Repository<WorkspaceTourThemeEntity>,
  workspaceId: string,
  seeds: readonly WorkspaceTourThemeSeed[],
): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const spec of seeds) {
    let row = await themeRepo.findOne({
      where: { workspaceId, slug: spec.slug },
    });
    if (!row) {
      row = themeRepo.create({
        workspaceId,
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        sortOrder: spec.sortOrder,
        isActive: true,
        formProfile: spec.formProfile,
      });
    } else {
      row.name = spec.name;
      row.description = spec.description;
      row.sortOrder = spec.sortOrder;
      row.isActive = true;
      row.formProfile = spec.formProfile;
    }
    row = await themeRepo.save(row);
    idBySlug.set(spec.slug, row.id);
  }
  emitScriptInfo(`Upserted ${seeds.length} workspace tour theme(s).`);
  return idBySlug;
}
