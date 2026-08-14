/**
 * PR8-B — read-only EncounterView UI safety proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";

import {
  CaseEncounterReadOnlyScreen,
  fixtureEnrollmentEncounter,
  fixtureMarketplaceBuyerEncounter,
  fixtureSubscriptionEncounter,
} from "../src/index.ts";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = join(PKG_ROOT, "src");

function walkSrc(dir = SRC_ROOT) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (readdirSync(dir, { withFileTypes: true }).find((d) => d.name === name)?.isDirectory()) {
      // handled below
    }
  }
  function walk(d) {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(ent.name)) files.push(full);
    }
  }
  walk(dir);
  return files;
}

function verdictDom(container) {
  const channels = [...container.querySelectorAll('[data-channel="verdict"]')].map((n) => n.textContent);
  return {
    reading: container.querySelector('[data-testid="case-encounter-reading"]')?.textContent,
    owner: container.querySelector('[data-testid="case-encounter-owner"]')?.textContent,
    posture: container.querySelector('[data-testid="case-encounter-posture"]')?.textContent,
    headline: container.querySelector('[data-testid="case-encounter-headline"]')?.textContent,
    verdictText: channels.join("\n"),
  };
}

describe("PR8-B case encounter read-only UI", () => {
  it("1 — UI sources import EncounterView contract only (no CaseOutput / FactSnapshot)", () => {
    for (const file of walkSrc()) {
      const text = readFileSync(file, "utf8");
      const imports = text.split("\n").filter((l) => /\bfrom\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(line, /CaseOutput|FactSnapshot|interpretFinanceCase|\/rules\//);
        assert.doesNotMatch(line, /@app-tour\/finance-core["']|workspace-denali|FinanceService/);
      }
    }
  });

  it("2 — same EncounterView produces same UI", () => {
    const encounter = fixtureEnrollmentEncounter();
    const a = render(createElement(CaseEncounterReadOnlyScreen, { encounter }));
    const first = a.container.innerHTML;
    cleanup();
    const b = render(createElement(CaseEncounterReadOnlyScreen, { encounter }));
    assert.equal(b.container.innerHTML, first);
    cleanup();
  });

  it("3 — signal / attention change does not modify verdict rendering", () => {
    const base = fixtureEnrollmentEncounter(null);
    const withSignal = fixtureEnrollmentEncounter({
      attentionClass: "receipt_review_requested",
      reasonCode: "queue",
    });
    assert.equal(base.reading, withSignal.reading);
    assert.equal(base.owner, withSignal.owner);
    assert.equal(base.explainability.headline, withSignal.explainability.headline);

    const a = render(createElement(CaseEncounterReadOnlyScreen, { encounter: base }));
    const verdictA = verdictDom(a.container);
    const attentionEmpty = a.container.querySelector(
      '[data-testid="case-encounter-attention-empty"]'
    );
    assert.ok(attentionEmpty);
    cleanup();

    const b = render(createElement(CaseEncounterReadOnlyScreen, { encounter: withSignal }));
    const verdictB = verdictDom(b.container);
    assert.deepEqual(
      {
        reading: verdictB.reading,
        owner: verdictB.owner,
        posture: verdictB.posture,
        headline: verdictB.headline,
      },
      {
        reading: verdictA.reading,
        owner: verdictA.owner,
        posture: verdictA.posture,
        headline: verdictA.headline,
      }
    );
    assert.equal(
      b.container.querySelector('[data-testid="case-encounter-attention-class"]')?.textContent,
      "receipt_review_requested"
    );
    assert.equal(
      b.container.querySelector('[data-channel="attention"]')?.getAttribute("data-testid"),
      "case-encounter-attention"
    );
    cleanup();
  });

  it("4 — same shell works for A/B/C subject kinds (no product branching)", () => {
    const fixtures = [
      fixtureEnrollmentEncounter(),
      fixtureSubscriptionEncounter(),
      fixtureMarketplaceBuyerEncounter(),
    ];
    for (const encounter of fixtures) {
      const view = render(createElement(CaseEncounterReadOnlyScreen, { encounter }));
      assert.ok(view.container.querySelector('[data-testid="case-encounter-identity"]'));
      assert.ok(view.container.querySelector('[data-testid="case-encounter-explanation"]'));
      assert.ok(view.container.querySelector('[data-testid="case-encounter-ownership"]'));
      assert.ok(view.container.querySelector('[data-testid="case-encounter-confidence"]'));
      assert.ok(view.container.querySelector('[data-testid="case-encounter-completeness"]'));
      assert.ok(view.container.querySelector('[data-testid="case-encounter-attention"]'));
      assert.equal(
        view.container.querySelector("[data-subject-kind]")?.getAttribute("data-subject-kind"),
        encounter.subjectKind
      );
      // No approve/reject/payment action controls.
      assert.equal(view.container.querySelector("button"), null);
      cleanup();
    }
  });

  it("5 — accessibility: confidence + completeness exposed as text", () => {
    const encounter = fixtureEnrollmentEncounter();
    const view = render(createElement(CaseEncounterReadOnlyScreen, { encounter }));
    assert.ok(view.getByText(encounter.confidence.whyVisible));
    assert.ok(view.getByText(encounter.confidence.whyMineOrNot));
    assert.ok(view.getByText(encounter.confidence.ifIWait));
    assert.ok(view.getByText(encounter.confidence.avoid));
    assert.ok(view.container.querySelector("#case-encounter-confidence-heading"));
    assert.ok(view.container.querySelector("#case-encounter-completeness-heading"));
    assert.equal(
      view.container.querySelector('[data-testid="case-encounter-act-ready"]')?.textContent,
      "yes"
    );
    cleanup();
  });

  it("6 — allow/forbid are non-interactive display hints", () => {
    const encounter = fixtureEnrollmentEncounter();
    const view = render(createElement(CaseEncounterReadOnlyScreen, { encounter }));
    const allow = view.container.querySelector('[data-testid="case-encounter-allow"]');
    assert.ok(allow);
    assert.equal(allow.querySelector("button"), null);
    assert.equal(allow.querySelector("a"), null);
    cleanup();
  });
});
