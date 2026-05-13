import assert from "node:assert/strict";
import test from "node:test";

import type { TourFormProfile } from "@repo/types";

import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { WorkspaceTourCreationPresetEntity } from "./entities/workspace-tour-creation-preset.entity";
import type { WorkspaceTourThemeEntity } from "./entities/workspace-tour-theme.entity";
import { TourCreationPresetsSettingsService } from "./tour-creation-presets-settings.service";

/**
 * Service-level coverage for `checkAndLogThemeProfileDrift`.
 *
 * Goal: prove the wiring between the service and `detectPresetThemeProfileDrift`
 * works end-to-end (a) without hitting the database and (b) without any
 * frontend changes — per the user direction "فقط backend diagnostics".
 *
 * Policy under test: soft / warn-only (preset is saved either way, drift is
 * surfaced via `logger.warn`).
 */

const WORKSPACE = "00000000-0000-4000-8000-000000000abc";
const USER = "00000000-0000-4000-8000-000000000def";

type WarnLog = string;

type FakePresetRow = WorkspaceTourCreationPresetEntity;

function makeRequestContextStub(): RequestContextService {
  return {
    resolveEffectiveTenantId: () => WORKSPACE,
    getUserId: () => USER,
  } as unknown as RequestContextService;
}

function makePresetsRepoStub() {
  const saved: FakePresetRow[] = [];
  const stub = {
    create: (partial: Partial<FakePresetRow>): FakePresetRow => {
      const row: FakePresetRow = {
        id: "preset-" + Math.random().toString(36).slice(2, 10),
        workspaceId: WORKSPACE,
        name: "",
        description: null,
        isActive: true,
        sortOrder: 0,
        matchTourType: null,
        matchMainTourThemeId: null,
        formProfile: "general",
        defaults: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        ...partial,
      } as FakePresetRow;
      return row;
    },
    save: async (row: FakePresetRow): Promise<FakePresetRow> => {
      saved.push(row);
      return row;
    },
    findOne: async () => null,
  };
  return { stub, saved };
}

function makeThemesRepoStub(catalog: Record<string, TourFormProfile>) {
  const calls: { id: unknown; workspaceId: unknown }[] = [];
  const stub = {
    findOne: async (opts: {
      where?: { id?: string; workspaceId?: string };
    }): Promise<Partial<WorkspaceTourThemeEntity> | null> => {
      const id = opts.where?.id;
      const workspaceId = opts.where?.workspaceId;
      calls.push({ id, workspaceId });
      if (typeof id !== "string") return null;
      const profile = catalog[id];
      if (!profile) return null;
      return { id, formProfile: profile };
    },
  };
  return { stub, calls };
}

function attachWarnSpy(svc: TourCreationPresetsSettingsService): WarnLog[] {
  const warnings: WarnLog[] = [];
  (svc as unknown as { logger: { warn: (msg: string) => void } }).logger = {
    warn: (msg: string) => warnings.push(msg),
  } as { warn: (msg: string) => void };
  return warnings;
}

function makeService(catalog: Record<string, TourFormProfile>) {
  const presets = makePresetsRepoStub();
  const themes = makeThemesRepoStub(catalog);
  const svc = new TourCreationPresetsSettingsService(
    presets.stub as never,
    themes.stub as never,
    makeRequestContextStub(),
  );
  const warnings = attachWarnSpy(svc);
  return { svc, warnings, themes, presets };
}

test("create: theme profile matches preset.formProfile → no drift warning", async () => {
  const { svc, warnings, themes } = makeService({ "theme-cinema": "cinema_event" });

  await svc.create({
    name: "Cinema preset",
    formProfile: "cinema_event",
    defaults: { overview: { mainTourThemeId: "theme-cinema" } },
  } as never);

  const drifts = warnings.filter((w) => w.includes("[presets][drift]"));
  assert.deepEqual(drifts, []);
  assert.equal(themes.calls.length, 1, "theme lookup should be invoked exactly once");
  assert.equal(themes.calls[0]?.workspaceId, WORKSPACE);
  assert.equal(themes.calls[0]?.id, "theme-cinema");
});

test("create: theme profile differs from preset.formProfile → warn (soft)", async () => {
  const { svc, warnings, presets } = makeService({ "theme-x": "cinema_event" });

  await svc.create({
    name: "Drifty preset",
    formProfile: "urban_event",
    defaults: { overview: { mainTourThemeId: "theme-x" } },
  } as never);

  const drifts = warnings.filter((w) => w.includes("[presets][drift]"));
  assert.equal(drifts.length, 1, "exactly one drift warning expected");
  assert.match(drifts[0]!, /preset_form_profile_mismatches_theme/);
  assert.match(drifts[0]!, /themeId=theme-x/);
  assert.match(drifts[0]!, /presetFormProfile=urban_event/);
  assert.match(drifts[0]!, /themeFormProfile=cinema_event/);
  assert.equal(
    presets.saved.length,
    1,
    "soft policy: preset must still be persisted on drift",
  );
});

test("create: referenced theme missing in workspace → warn (soft)", async () => {
  const { svc, warnings, presets } = makeService({});

  await svc.create({
    name: "Ghost theme preset",
    formProfile: "general",
    defaults: { overview: { mainTourThemeId: "ghost-theme" } },
  } as never);

  const drifts = warnings.filter((w) => w.includes("[presets][drift]"));
  assert.equal(drifts.length, 1);
  assert.match(drifts[0]!, /preset_theme_not_in_workspace/);
  assert.match(drifts[0]!, /themeId=ghost-theme/);
  assert.match(drifts[0]!, /presetFormProfile=general/);
  assert.equal(presets.saved.length, 1);
});

test("create: legacy matchMainTourThemeId is also consulted for drift", async () => {
  const { svc, warnings, themes } = makeService({ "legacy-theme": "cinema_event" });

  await svc.create({
    name: "Legacy match",
    formProfile: "urban_event",
    matchMainTourThemeId: "legacy-theme",
    defaults: {},
  } as never);

  const drifts = warnings.filter((w) => w.includes("[presets][drift]"));
  assert.equal(drifts.length, 1);
  assert.match(drifts[0]!, /preset_form_profile_mismatches_theme/);
  assert.match(drifts[0]!, /themeId=legacy-theme/);
  assert.equal(themes.calls[0]?.id, "legacy-theme");
});

test("create: no theme id at all → drift check is silent", async () => {
  const { svc, warnings, themes } = makeService({});

  await svc.create({
    name: "Profile-only preset",
    formProfile: "general",
    defaults: { policies: { cancellationPolicy: "flexible" } },
  } as never);

  const drifts = warnings.filter((w) => w.includes("[presets][drift]"));
  assert.deepEqual(drifts, []);
  assert.equal(
    themes.calls.length,
    0,
    "should not hit the theme repo when no theme id is referenced",
  );
});
