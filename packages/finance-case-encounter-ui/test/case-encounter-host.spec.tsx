/**
 * PR8-B — Host load/refresh owns lifecycle; screen stays presentational.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";

import {
  CaseEncounterReadOnlyHost,
  fixtureEnrollmentEncounter,
} from "../src/index.ts";

afterEach(() => {
  cleanup();
});

describe("PR8-B CaseEncounterReadOnlyHost", () => {
  it("loads encounter via injected loader and refreshes", async () => {
    let calls = 0;
    const loadEncounter = async () => {
      calls += 1;
      return fixtureEnrollmentEncounter();
    };
    const view = render(
      createElement(CaseEncounterReadOnlyHost, {
        loadEncounter,
        counterpartyLabel: "Member display",
      })
    );
    await waitFor(() => {
      assert.ok(view.container.querySelector('[data-testid="case-encounter-read-only-screen"]'));
    });
    assert.equal(calls, 1);
    assert.equal(
      view.container.querySelector('[data-testid="case-encounter-counterparty"]')?.textContent,
      "Member display"
    );
    fireEvent.click(view.getByTestId("case-encounter-refresh"));
    await waitFor(() => {
      assert.equal(calls, 2);
    });
  });

  it("surfaces load errors without mutating", async () => {
    const view = render(
      createElement(CaseEncounterReadOnlyHost, {
        loadEncounter: async () => {
          throw new Error("upstream_unavailable");
        },
      })
    );
    await waitFor(() => {
      assert.equal(
        view.container.querySelector('[data-testid="case-encounter-error"]')?.textContent,
        "upstream_unavailable"
      );
    });
    assert.equal(view.container.querySelector('[data-testid="case-encounter-read-only-screen"]'), null);
  });
});
