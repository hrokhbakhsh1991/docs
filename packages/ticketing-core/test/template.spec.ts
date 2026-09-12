import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  escapeHtmlText,
  findDisallowedTemplateTokens,
  interpolateTicketTemplate,
  sanitizeTicketTemplateBody,
} from "../src/domain/template";

describe("ticketing-core template", () => {
  it("interpolates allowlisted variables only", () => {
    const out = interpolateTicketTemplate("Hello {{ticketSubject}} — {{evil}}", {
      ticketSubject: "Help",
    });
    assert.equal(out, "Hello Help — ");
    assert.deepEqual(findDisallowedTemplateTokens("{{evil}} {{ticketId}}"), ["evil"]);
  });

  it("strips script tags and event handlers", () => {
    const raw = '<script>alert(1)</script><img onerror="x" src="javascript:alert(2)">';
    assert.equal(sanitizeTicketTemplateBody(raw), '<img src="alert(2)">');
  });

  it("escapes HTML when requested", () => {
    assert.equal(
      interpolateTicketTemplate("{{ticketSubject}}", { ticketSubject: "<b>x</b>" }, { escapeHtml: true }),
      escapeHtmlText("<b>x</b>"),
    );
  });

  it("supports FA locale content without code execution", () => {
    const fa = interpolateTicketTemplate("سلام {{ticketSubject}}", { ticketSubject: "تیکت" });
    assert.equal(fa, "سلام تیکت");
  });
});
