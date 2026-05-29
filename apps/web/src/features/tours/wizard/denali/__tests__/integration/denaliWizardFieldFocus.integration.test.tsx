import { afterEach, describe, expect, it } from "@jest/globals";

import { clearDenaliWizardFieldFocus, focusDenaliWizardField } from "../../denaliWizardFieldFocus";

describe("focusDenaliWizardField", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearDenaliWizardFieldFocus();
  });

  it("focuses basicInfo.title via data-field-path", () => {
    document.body.innerHTML = `
      <div class="field">
        <input type="text" data-field-path="basicInfo.title" />
      </div>
    `;
    const input = document.querySelector<HTMLInputElement>('[data-field-path="basicInfo.title"]');
    expect(input).not.toBeNull();

    focusDenaliWizardField("basicInfo.title");

    expect(document.activeElement).toBe(input);
    expect(input?.closest("[data-denali-focus='true']")).not.toBeNull();
  });

  it("focuses basicInfo.capacityMax via data-field-path", () => {
    document.body.innerHTML = `<input data-field-path="basicInfo.capacityMax" />`;
    const input = document.querySelector<HTMLInputElement>('[data-field-path="basicInfo.capacityMax"]');
    focusDenaliWizardField("basicInfo.capacityMax");
    expect(document.activeElement).toBe(input);
  });

  it("focuses pricingPayment.includesTourInsurance via data-field-path", () => {
    document.body.innerHTML = `<input type="checkbox" data-field-path="pricingPayment.includesTourInsurance" data-testid="denali-pricing-tour-insurance" />`;
    const input = document.querySelector<HTMLInputElement>(
      '[data-field-path="pricingPayment.includesTourInsurance"]',
    );
    focusDenaliWizardField("pricingPayment.includesTourInsurance");
    expect(document.activeElement).toBe(input);
  });

  it("focuses participantRequirements.sportsInsuranceRequired via data-field-path", () => {
    document.body.innerHTML = `<input type="checkbox" data-field-path="participantRequirements.sportsInsuranceRequired" data-testid="denali-pricing-sports-insurance" />`;
    const input = document.querySelector<HTMLInputElement>(
      '[data-field-path="participantRequirements.sportsInsuranceRequired"]',
    );
    focusDenaliWizardField("participantRequirements.sportsInsuranceRequired");
    expect(document.activeElement).toBe(input);
  });

  it("focuses tripDetails.logistics.gatheringPoints via gathering widget", () => {
    document.body.innerHTML = `<div data-testid="denali-gathering-points-widget" data-field-path="tripDetails.logistics.gatheringPoints"><button type="button">add</button></div>`;
    focusDenaliWizardField("tripDetails.logistics.gatheringPoints");
    expect(document.activeElement?.tagName).toBe("BUTTON");
  });

  it("focuses policies.policiesText via data-field-path on legal step", () => {
    document.body.innerHTML = `<textarea data-field-path="policies.policiesText" data-testid="denali-legal-policies-notes"></textarea>`;
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-field-path="policies.policiesText"]',
    );
    focusDenaliWizardField("policies.policiesText");
    expect(document.activeElement).toBe(textarea);
  });

  it("focuses basicInfo.publishStatus on review via data-field-path wrapper", () => {
    document.body.innerHTML = `
      <div data-field-path="basicInfo.publishStatus" data-testid="denali-review-publish-status">
        <button type="button">draft</button>
      </div>
    `;
    focusDenaliWizardField("basicInfo.publishStatus");
    expect(document.activeElement?.tagName).toBe("BUTTON");
  });
});
