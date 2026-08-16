import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { render } from "@testing-library/react";

import { Input } from "./Input";

describe("Input", () => {
  it("renders textbox", () => {
    const { getByRole } = render(<Input aria-label="Title" />);
    assert.ok(getByRole("textbox", { name: "Title" }));
  });

  it("does not serialize aria-invalid when valid", () => {
    const { getByRole } = render(<Input aria-label="ok-field" />);
    assert.equal(getByRole("textbox", { name: "ok-field" }).hasAttribute("aria-invalid"), false);
  });

  it("assigns id", () => {
    render(<Input id="custom-id" aria-label="x" />);
    assert.equal(document.getElementById("custom-id")?.id, "custom-id");
  });

  it("forwards ref", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} aria-label="x" />);
    assert.ok(ref.current instanceof HTMLInputElement);
  });
});
