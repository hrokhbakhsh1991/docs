import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { render } from "@testing-library/react";

import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders children", () => {
    const { getByText } = render(<Badge variant="success">Active</Badge>);
    assert.ok(getByText("Active"));
  });

  it("sets data-variant", () => {
    const { container } = render(<Badge variant="warning">Draft</Badge>);
    const badge = container.querySelector("span[data-variant='warning']");
    assert.ok(badge);
  });

  it("forwards ref", () => {
    const ref = { current: null as HTMLSpanElement | null };
    render(<Badge ref={ref}>Tagged</Badge>);
    assert.ok(ref.current instanceof HTMLSpanElement);
  });
});
