"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var strict_1 = require("node:assert/strict");
var node_test_1 = require("node:test");
var marketing_home_hero_payload_1 = require("../src/marketing-home-hero-payload");
(0, node_test_1.describe)("marketing-pages-http-contracts", function () {
    (0, node_test_1.it)("parses home hero payload", function () {
        var payload = (0, marketing_home_hero_payload_1.parseMarketingHomeHeroPayload)({
            lead: "سلام",
            support: "توضیح",
            ctaPrimary: "برو",
        });
        strict_1.default.equal(payload.lead, "سلام");
    });
    (0, node_test_1.it)("defaults locale to fa", function () {
        strict_1.default.equal((0, marketing_home_hero_payload_1.parseMarketingPageLocale)(null), "fa");
        strict_1.default.equal((0, marketing_home_hero_payload_1.parseMarketingPageLocale)("en"), "en");
    });
});
