import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { render } from "@testing-library/react";

import { Input } from "../Input/Input";
import { FieldShell } from "./FieldShell";

describe("FieldShell", () => {
  it("associates label with control", () => {
    const { getByRole, getByText } = render(
      <FieldShell label="Email">
        <Input aria-label="email-input" />
      </FieldShell>,
    );
    const input = getByRole("textbox", { name: "email-input" });
    const label = getByText("Email").closest("label");
    assert.equal(label?.getAttribute("for"), input.id);
  });

  it("sets aria-describedby for helper text", () => {
    const { getByRole } = render(
      <FieldShell label="Name" helperText="Legal name">
        <Input aria-label="name-input" />
      </FieldShell>,
    );
    const input = getByRole("textbox", { name: "name-input" });
    assert.ok(input.getAttribute("aria-describedby")?.includes("-help"));
  });

  it("sets aria-invalid when error present", () => {
    const { getByRole } = render(
      <FieldShell label="Code" error="Required">
        <Input aria-label="code-input" />
      </FieldShell>,
    );
    assert.equal(getByRole("textbox", { name: "code-input" }).getAttribute("aria-invalid"), "true");
  });

  it("shows required mark", () => {
    const { container } = render(
      <FieldShell label="Title" required>
        <Input aria-label="title-input" />
      </FieldShell>,
    );
    assert.ok(container.querySelector('[aria-hidden="true"]'));
  });

  it("forwards ref", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <FieldShell ref={ref} label="Ref field">
        <Input aria-label="ref-input" />
      </FieldShell>,
    );
    assert.ok(ref.current instanceof HTMLDivElement);
  });
});
