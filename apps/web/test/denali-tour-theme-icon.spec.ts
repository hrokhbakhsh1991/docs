import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const DENALI_ROOT = join(import.meta.dirname, "../../../packages/workspaces/denali");
const WEB_ROOT = join(import.meta.dirname, "..");
const API_ROOT = join(import.meta.dirname, "../../../apps/api");

describe("denali-tour-theme-icon.spec.ts", () => {
  it("DN-THEME-ICON-01 tour theme avatar uses Tag fallback not initials", () => {
    const avatar = readFileSync(
      join(DENALI_ROOT, "src/ui/components/tour-theme-catalog-avatar.tsx"),
      "utf8"
    );
    assert.match(avatar, /from "lucide-react"/);
    assert.match(avatar, /<Tag/);
    assert.doesNotMatch(avatar, /themeDisplayInitials/);
  });

  it("DN-THEME-ICON-02 settings tour themes expose icon picker + avatar surface", () => {
    const client = readFileSync(
      join(WEB_ROOT, "app/(app)/settings/tour-themes/tour-themes-client.tsx"),
      "utf8"
    );
    assert.match(client, /EquipmentIconPicker/);
    assert.match(client, /TourThemeCatalogAvatar/);
    assert.match(client, /iconKey/);
  });

  it("DN-THEME-ICON-03 API persists optional iconKey on tour themes", () => {
    const schema = readFileSync(join(API_ROOT, "prisma/schema.prisma"), "utf8");
    assert.match(schema, /iconKey\s+String\?\s+@map\("icon_key"\)/);
    const service = readFileSync(join(API_ROOT, "src/settings/settings.service.ts"), "utf8");
    assert.match(service, /parseEquipmentIconKeyInput\(themeBody\.iconKey/);
  });

  it("DN-THEME-ICON-04 catalog multi-picker supports custom leading avatars", () => {
    const picker = readFileSync(
      join(DENALI_ROOT, "src/ui/components/denali-catalog-multi-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /renderItemLeading/);
    assert.match(picker, /renderChipLeading/);
  });

  it("DN-THEME-ICON-05 icon picker preserves button semantics", () => {
    const picker = readFileSync(
      join(DENALI_ROOT, "src/ui/components/equipment-icon-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /type="button"/);
    assert.doesNotMatch(picker, /role="listitem"/);
  });
});
