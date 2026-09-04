import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatTicketCode, parseTicketCodeQuery } from "../src/domain/search/ticket-code";

describe("ticketing search ticket code", () => {
  it("formats ticket codes with zero padding", () => {
    assert.equal(formatTicketCode(1), "TKT-000001");
    assert.equal(formatTicketCode(42), "TKT-000042");
  });

  it("parses prefixed and numeric ticket code queries", () => {
    assert.equal(parseTicketCodeQuery("TKT-000042"), 42);
    assert.equal(parseTicketCodeQuery("tkt-7"), 7);
    assert.equal(parseTicketCodeQuery("15"), 15);
    assert.equal(parseTicketCodeQuery("refund"), null);
  });
});
