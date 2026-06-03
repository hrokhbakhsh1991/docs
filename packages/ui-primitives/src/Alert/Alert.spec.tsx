import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { render } from "@testing-library/react";

import { Alert } from "./Alert";

describe("Alert", () => {
  it("renders title and body", () => {
    const { getByRole, getByText } = render(
      <Alert variant="info" title="Heads up">
        Details here
      </Alert>,
    );
    assert.ok(getByRole("status"));
    assert.ok(getByText("Heads up"));
    assert.ok(getByText("Details here"));
  });

  it("uses alert role for error variant", () => {
    const { getByRole } = render(<Alert variant="error">Failed</Alert>);
    assert.ok(getByRole("alert"));
  });

  it("forwards ref", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <Alert ref={ref} variant="info">
        Body
      </Alert>,
    );
    assert.ok(ref.current instanceof HTMLDivElement);
  });
});
