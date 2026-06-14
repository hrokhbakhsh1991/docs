import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import React, { useState } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";

import { loadAppMessages } from "../src/i18n/load-messages";
import {
  DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS,
  DenaliItinerarySegmentDestinationField,
} from "../src/wizard/denali/denali-itinerary-segment-destination-field";
import {
  DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS,
  DenaliItinerarySegmentPhotoPicker,
} from "../src/wizard/denali/denali-itinerary-segment-photo-picker";

let testMessages: AbstractIntlMessages;
let originalFetch: typeof globalThis.fetch;

before(async () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  testMessages = await loadAppMessages("en");
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function renderPicker(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={testMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("denali-itinerary-segment-pickers.spec.tsx", () => {
  it("WEB-DENALI-ITIN-18 photo picker toggles selection via test ids", () => {
    function Harness() {
      const [selectedIds, setSelectedIds] = useState<string[]>([]);
      return (
        <DenaliItinerarySegmentPhotoPicker
          photos={[
            { id: "p1", label: "Summit" },
            { id: "p2", label: "Camp" },
          ]}
          selectedIds={selectedIds}
          dayNumber={1}
          onChange={setSelectedIds}
        />
      );
    }

    const { getByTestId } = renderPicker(<Harness />);

    assert.ok(getByTestId(DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS.picker));
    fireEvent.click(getByTestId(DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS.toggle("p1")));
    assert.equal(
      getByTestId(DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS.toggle("p1")).getAttribute("aria-pressed"),
      "true"
    );

    fireEvent.click(getByTestId(DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS.toggle("p1")));
    assert.equal(
      getByTestId(DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS.toggle("p1")).getAttribute("aria-pressed"),
      "false"
    );
  });

  it("WEB-DENALI-ITIN-19 destination picker emits destinationId and locationLabel", async () => {
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          regions: [{ id: "region-1", name: "Alborz" }],
          destinations: [
            { id: "dest-1", regionId: "region-1", name: "Damavand", isActive: true },
          ],
          total: 2,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    try {
      const changes: Array<{ destinationId?: string; locationLabel?: string }> = [];
      const { container } = renderPicker(
        <DenaliItinerarySegmentDestinationField
          onChange={(selection) => changes.push(selection)}
        />
      );

      await waitFor(() => {
        const select = container.querySelector("select");
        assert.ok(select);
        assert.ok(select?.options.length > 1);
      });

      const select = container.querySelector("select");
      assert.ok(select);
      fireEvent.change(select!, { target: { value: "dest-1" } });

      assert.deepEqual(changes.at(-1), {
        destinationId: "dest-1",
        locationLabel: "Damavand",
      });
      assert.ok(
        container.querySelector(
          `[data-testid="${DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS.select}"]`
        )
      );
    } finally {
      globalThis.fetch = prevFetch;
    }
  });
});
