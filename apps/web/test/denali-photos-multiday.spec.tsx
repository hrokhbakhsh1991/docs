import assert from "node:assert/strict";
import { before, afterEach, describe, it } from "node:test";
import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import React, { useState } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";

import { loadAppMessages } from "../src/i18n/load-messages";
import {
  DENALI_PHOTOS_TEST_IDS,
  DenaliPhotosField,
} from "@app-tour/workspace-denali/host/ui/fields/photos";
import {
  emptyDenaliTourWizardDraft,
  setCanonicalStringValue,
  setCanonicalValue,
  type DenaliTourWizardDraft,
} from "@app-tour/workspace-denali/host/draft/tour-wizard";

let testMessages: AbstractIntlMessages;

before(async () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  testMessages = await loadAppMessages("fa");
});

afterEach(() => {
  cleanup();
});

function buildMultiDayDraft(
  dayCount: number,
  photos: Array<{ id: string; day: number; label?: string; url?: string }>
): DenaliTourWizardDraft {
  const start = "2026-06-01T08:00:00.000Z";
  const endDay = String(dayCount).padStart(2, "0");
  let draft = emptyDenaliTourWizardDraft();
  draft = setCanonicalStringValue(draft, "category", "mountain_multi");
  draft = setCanonicalStringValue(draft, "startDateTime", start);
  draft = setCanonicalStringValue(draft, "endDateTime", `2026-06-${endDay}T18:00:00.000Z`);
  draft = setCanonicalValue(draft, "photos", photos);
  return draft;
}

function renderPhotosField(initialDraft: DenaliTourWizardDraft) {
  function Harness() {
    const [draft, setDraft] = useState(initialDraft);
    return (
      <DenaliPhotosField
        draft={draft}
        onDraftChange={setDraft}
        wizardSessionId="a1b2c3d4-e5f6-4789-a012-3456789abcde"
      />
    );
  }

  const view = render(
    <NextIntlClientProvider locale="fa" messages={testMessages}>
      <Harness />
    </NextIntlClientProvider>
  );
  const root = within(view.getByTestId(DENALI_PHOTOS_TEST_IDS.photos));
  return { ...view, root };
}

describe("denali-photos-multiday.spec.tsx", () => {
  it("WEB-DENALI-PHOTO-01 single-day tour uses flat grid + global add", () => {
    let draft = emptyDenaliTourWizardDraft();
    draft = setCanonicalStringValue(draft, "category", "mountain_day");
    draft = setCanonicalValue(draft, "photos", [
      { id: "solo", label: "Only", url: "https://cdn.example/solo.webp" },
    ]);

    const { root, queryByTestId } = renderPhotosField(draft);
    assert.ok(root.getByTestId(DENALI_PHOTOS_TEST_IDS.addPhoto));
    assert.equal(queryByTestId(DENALI_PHOTOS_TEST_IDS.daySections), null);
  });

  it("WEB-DENALI-PHOTO-02 three-day tour groups photos into day sections", () => {
    const draft = buildMultiDayDraft(3, [
      { id: "p1", day: 1, label: "D1", url: "https://cdn.example/1.webp" },
      { id: "p2", day: 2, label: "D2", url: "https://cdn.example/2.webp" },
      { id: "p3", day: 3, label: "D3", url: "https://cdn.example/3.webp" },
    ]);

    const { root } = renderPhotosField(draft);
    assert.ok(root.getByTestId(DENALI_PHOTOS_TEST_IDS.daySections));
    assert.ok(root.getByTestId(DENALI_PHOTOS_TEST_IDS.daySection(1)));
    assert.ok(root.getByTestId(DENALI_PHOTOS_TEST_IDS.daySection(3)));
    assert.ok(root.getByTestId(DENALI_PHOTOS_TEST_IDS.dayGrid(2)));
    assert.equal(within(root.getByTestId(DENALI_PHOTOS_TEST_IDS.dayGrid(1))).getAllByRole("img").length, 1);
  });

  it("WEB-DENALI-PHOTO-03 seven-day tour renders compact day sections", () => {
    const photos = Array.from({ length: 7 }, (_, index) => ({
      id: `p${index + 1}`,
      day: index + 1,
      label: `Day ${index + 1}`,
      url: `https://cdn.example/${index + 1}.webp`,
    }));
    const draft = buildMultiDayDraft(7, photos);
    const { root, getByTestId } = renderPhotosField(draft);

    for (let day = 1; day <= 7; day += 1) {
      assert.ok(root.getByTestId(DENALI_PHOTOS_TEST_IDS.daySection(day)));
    }
    const daySeven = root.getByTestId(DENALI_PHOTOS_TEST_IDS.daySection(7));
    assert.equal(daySeven.tagName.toLowerCase(), "details");
    assert.ok(root.getByTestId(DENALI_PHOTOS_TEST_IDS.addPhotoToDay(7)));
  });

  it("WEB-DENALI-PHOTO-04 add photo to day assigns correct day bucket", () => {
    const draft = buildMultiDayDraft(3, []);
    const { root } = renderPhotosField(draft);

    fireEvent.click(root.getByTestId(DENALI_PHOTOS_TEST_IDS.addPhotoToDay(2)));
    const grid = root.getByTestId(DENALI_PHOTOS_TEST_IDS.dayGrid(2));
    const card = grid.querySelector("[data-operator-photo-day='2']");
    assert.ok(card);
  });

  it("WEB-DENALI-PHOTO-05 remove deletes only targeted photo/day card", () => {
    const draft = buildMultiDayDraft(3, [
      { id: "keep", day: 1, label: "Keep", url: "https://cdn.example/keep.webp" },
      { id: "drop", day: 2, label: "Drop", url: "https://cdn.example/drop.webp" },
    ]);

    const { root } = renderPhotosField(draft);
    const dayTwoGrid = root.getByTestId(DENALI_PHOTOS_TEST_IDS.dayGrid(2));
    const removeButton = within(dayTwoGrid).getByRole("button", { name: /حذف عکس/i });
    fireEvent.click(removeButton);

    assert.ok(root.getByTestId(DENALI_PHOTOS_TEST_IDS.dayGrid(1)));
    assert.throws(() => root.getByTestId(DENALI_PHOTOS_TEST_IDS.dayGrid(2)));
  });

  it("WEB-DENALI-PHOTO-06 tour cover badge marks first canonical photo only", () => {
    const draft = buildMultiDayDraft(3, [
      { id: "cover", day: 2, label: "Cover on day 2", url: "https://cdn.example/cover.webp" },
      { id: "other", day: 1, label: "Other", url: "https://cdn.example/other.webp" },
    ]);

    const { root } = renderPhotosField(draft);
    assert.equal(root.getAllByTestId(DENALI_PHOTOS_TEST_IDS.coverBadge).length, 1);
    const coverCard = root.getByTestId(DENALI_PHOTOS_TEST_IDS.dayGrid(2)).querySelector(
      "[data-operator-photo-global-index='0']"
    );
    assert.ok(coverCard?.querySelector(`[data-testid='${DENALI_PHOTOS_TEST_IDS.coverBadge}']`));
  });
});
