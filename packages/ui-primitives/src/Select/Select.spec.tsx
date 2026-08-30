import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { render } from "@testing-library/react";

import { Select } from "./Select";

describe("Select", () => {
  it("renders combobox with options", () => {
    const { getByRole } = render(
      <Select
        aria-label="Status"
        options={[
          { value: "draft", label: "Draft" },
          { value: "open", label: "Open" },
        ]}
        value="draft"
        onChange={() => {}}
      />,
    );
    const control = getByRole("combobox", { name: "Status" }) as HTMLSelectElement;
    assert.equal(control.value, "draft");
    assert.equal(control.options.length, 2);
  });

  it("sets aria-invalid when invalid", () => {
    const { container } = render(
      <Select
        aria-label="Status"
        options={[{ value: "a", label: "A" }]}
        invalid
        onChange={() => {}}
      />,
    );
    const control = container.querySelector("select");
    assert.equal(control?.getAttribute("aria-invalid"), "true");
  });

  it("exposes data-ui-select affordance hook", () => {
    const { container } = render(
      <Select
        aria-label="Status"
        options={[{ value: "a", label: "A" }]}
        onChange={() => {}}
      />,
    );
    const control = container.querySelector("select");
    assert.ok(control?.hasAttribute("data-ui-select"));
  });
});
