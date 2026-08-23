import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  WIZARD_CATALOG_ENUM_PATHS,
  resolveWizardEnumOptionLabel,
  resolveWizardTourCategoryGroupLabel,
  resolveWizardTourDurationLabel,
  resolveWizardTourKindLabel,
} from "../src/wizard/wizard-label-surface-registry";
import { WIZARD_LABEL_RESOLVER_CACHE_KEY } from "../src/wizard/wizard-label-registry";

describe("wizard-label-surface-registry enum fallback", () => {
  it("resolves readable labels from translator when resolver cache is not warm", () => {
    const translate = (key: string): string =>
      (
        ({
          "tourKinds.mountain_multi": "کوهنوردی — چندروزه",
          "composites.tourKind.categories.mountain": "کوهنوردی",
          "composites.tourKind.durations.multi_day": "چندروزه",
          "transportModes.shared_cars": "ماشین‌های مشترک (دنگ)",
        }) as Record<string, string>
      )[key] ?? key;

    assert.equal(
      resolveWizardTourKindLabel(undefined, translate, "mountain_multi"),
      "کوهنوردی — چندروزه"
    );
    assert.equal(resolveWizardTourCategoryGroupLabel(undefined, translate, "mountain"), "کوهنوردی");
    assert.equal(resolveWizardTourDurationLabel(undefined, translate, "multi_day"), "چندروزه");
    assert.equal(
      resolveWizardEnumOptionLabel(
        undefined,
        translate,
        WIZARD_CATALOG_ENUM_PATHS.transportMode,
        "shared_cars"
      ),
      "ماشین‌های مشترک (دنگ)"
    );
  });

  it("falls back to readable slug when no translation key exists", () => {
    const translate = (key: string): string => key;

    assert.equal(
      resolveWizardTourKindLabel(undefined, translate, "mountain_multi"),
      "mountain multi"
    );
    assert.equal(resolveWizardTourDurationLabel(undefined, translate, "multi_day"), "multi day");
  });

  it("resolves tourKinds and composites keys under the active workspace namespace", () => {
    const translate = (key: string): string =>
      (
        ({
          "composites.tourKind.categories.mountain": "کوهنوردی",
          "tourKinds.mountain_day": "کوهنوردی — تک‌روزه",
          "tourKinds.mountain_multi": "کوهنوردی — چندروزه",
          "composites.tourKind.categories.nature": "طبیعت",
          "tourKinds.nature_day": "طبیعت — تک‌روزه",
          "tourKinds.nature_multi": "طبیعت — چندروزه",
          "composites.tourKind.categories.desert": "کویر",
          "tourKinds.desert_day": "کویر — تک‌روزه",
          "tourKinds.desert_multi": "کویر — چندروزه",
          "composites.tourKind.categories.event": "رویداد",
          "tourKinds.event_reading": "رویداد — کتابخوانی (تک‌روزه)",
          "tourKinds.event_reading_multi": "رویداد — کتابخوانی (چندروزه)",
          "tourKinds.event_cinema": "رویداد — سینما (تک‌روزه)",
          "tourKinds.event_cinema_multi": "رویداد — سینما (چندروزه)",
        }) as Record<string, string>
      )[key] ?? key;

    assert.equal(resolveWizardTourCategoryGroupLabel(undefined, translate, "mountain"), "کوهنوردی");
    assert.equal(
      resolveWizardTourKindLabel(undefined, translate, "mountain_day"),
      "کوهنوردی — تک‌روزه"
    );
    assert.equal(
      resolveWizardTourKindLabel(undefined, translate, "event_cinema_multi"),
      "رویداد — سینما (چندروزه)"
    );
  });

  it("skips missing keys via has() without calling translate", () => {
    let translateCalls = 0;
    const translate = Object.assign(
      (key: string): string => {
        translateCalls += 1;
        if (key === "tourKinds.mountain_multi") {
          return "کوهنوردی — چندروزه";
        }
        throw new Error(`MISSING_MESSAGE:${key}`);
      },
      {
        has: (key: string) => key === "tourKinds.mountain_multi",
      }
    );

    assert.equal(
      resolveWizardTourKindLabel(undefined, translate, "mountain_multi"),
      "کوهنوردی — چندروزه"
    );
    assert.equal(translateCalls, 1);
  });

  it("continues fallback when translator throws missing message", () => {
    const translate = (key: string): string => {
      if (key.startsWith("enumOptions.")) {
        throw new Error(`MISSING_MESSAGE:${key}`);
      }
      if (key === "tourKinds.mountain_multi") {
        return "کوهنوردی — چندروزه";
      }
      return key;
    };

    assert.equal(
      resolveWizardTourKindLabel(undefined, translate, "mountain_multi"),
      "کوهنوردی — چندروزه"
    );
  });

  it("falls back when generated resolver throws missing message", () => {
    const surfaceId = "denali-test-surface";
    const cache = new Map<string, unknown>();
    cache.set(surfaceId, {
      resolveFieldLabel: () => "noop",
      resolveStepLabel: () => "noop",
      resolveEnumOptionLabel: () => {
        throw new Error("MISSING_MESSAGE");
      },
    });
    Object.assign(globalThis as Record<string, unknown>, {
      [WIZARD_LABEL_RESOLVER_CACHE_KEY]: cache,
    });

    const translate = (key: string): string =>
      key === "tourKinds.mountain_day" ? "کوهنوردی — تک‌روزه" : key;

    assert.equal(
      resolveWizardTourKindLabel(surfaceId, translate, "mountain_day"),
      "کوهنوردی — تک‌روزه"
    );
  });

  it("falls back when generated resolver returns unresolved key string", () => {
    const surfaceId = "denali-test-surface-unresolved";
    const cache = new Map<string, unknown>();
    cache.set(surfaceId, {
      resolveFieldLabel: () => "noop",
      resolveStepLabel: () => "noop",
      resolveEnumOptionLabel: () => "enumOptions.tour.kind.mountain_day",
    });
    Object.assign(globalThis as Record<string, unknown>, {
      [WIZARD_LABEL_RESOLVER_CACHE_KEY]: cache,
    });

    const translate = (key: string): string =>
      key === "tourKinds.mountain_day" ? "کوهنوردی — تک‌روزه" : key;

    assert.equal(
      resolveWizardTourKindLabel(surfaceId, translate, "mountain_day"),
      "کوهنوردی — تک‌روزه"
    );
  });

  it("treats unresolved prefixed workspace keys as generic missing labels", () => {
    const surfaceId = "alpine-test-surface-unresolved";
    const cache = new Map<string, unknown>();
    cache.set(surfaceId, {
      resolveFieldLabel: () => "noop",
      resolveStepLabel: () => "noop",
      resolveEnumOptionLabel: () => "alpine.fields.tour.kind",
    });
    Object.assign(globalThis as Record<string, unknown>, {
      [WIZARD_LABEL_RESOLVER_CACHE_KEY]: cache,
    });

    const translate = (key: string): string =>
      key === "tourKinds.mountain_day" ? "Alpine day trek" : key;

    assert.equal(
      resolveWizardTourKindLabel(surfaceId, translate, "mountain_day"),
      "Alpine day trek"
    );
  });

  it("ignores unresolved workspace-prefixed key strings and continues to tourKinds", () => {
    const translate = (key: string): string => {
      if (key === "tourKinds.mountain_day") {
        return "کوهنوردی — تک‌روزه";
      }
      return `alpine.${key}`;
    };

    assert.equal(
      resolveWizardTourKindLabel(undefined, translate, "mountain_day"),
      "کوهنوردی — تک‌روزه"
    );
  });
});
