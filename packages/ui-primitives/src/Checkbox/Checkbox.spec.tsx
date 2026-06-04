import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { render } from "@testing-library/react";

import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("renders checkbox", () => {
    const { getByRole } = render(<Checkbox aria-label="Featured" />);
    assert.ok(getByRole("checkbox", { name: "Featured" }));
  });

  it("sets aria-invalid when invalid", () => {
    const { container } = render(<Checkbox aria-label="Featured" invalid />);
    const control = container.querySelector('input[type="checkbox"]');
    assert.equal(control?.getAttribute("aria-invalid"), "true");
  });
});
