import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { render } from "@testing-library/react";

import { Button } from "./Button";

describe("Button", () => {
  it("renders children", () => {
    const { getByRole } = render(<Button>Save</Button>);
    assert.ok(getByRole("button", { name: "Save" }));
  });

  it("applies variant class", () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const button = container.querySelector("button");
    assert.equal(button?.getAttribute("data-variant"), "secondary");
  });

  it("respects disabled", () => {
    const { getByRole } = render(<Button disabled>Off</Button>);
    assert.equal(getByRole("button", { name: "Off" }).hasAttribute("disabled"), true);
  });

  it("forwards ref", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Ref</Button>);
    assert.ok(ref.current instanceof HTMLButtonElement);
  });
});
