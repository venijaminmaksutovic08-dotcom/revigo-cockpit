// Regression tests for the competitor-lookup failure classification. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCompetitorLookupStatus, competitorEmptyStateMessage } from "./competitorLookup.ts";

test("classifyCompetitorLookupStatus: 429 is quota_exceeded", () => {
  assert.equal(classifyCompetitorLookupStatus(429), "quota_exceeded");
});

test("classifyCompetitorLookupStatus: 503 and 502 are not_configured (missing key / unexpected upstream failure)", () => {
  assert.equal(classifyCompetitorLookupStatus(503), "not_configured");
  assert.equal(classifyCompetitorLookupStatus(502), "not_configured");
});

test("classifyCompetitorLookupStatus: 200 is not a failure — the lookup ran to completion", () => {
  assert.equal(classifyCompetitorLookupStatus(200), null);
});

// ── The two required distinct messages ──────────────────────────────────────────

test("case 1: key not configured / lookup failed shows the 'not set up' message, not the generic empty one", () => {
  const msg = competitorEmptyStateMessage("not_configured");
  assert.match(msg, /nije podešena/);
  assert.doesNotMatch(msg, /Nema dostupnih cena konkurencije/, "must not read as a genuine empty result");
});

test("case 2: lookup ran and genuinely found nothing shows the plain empty-result message", () => {
  const msg = competitorEmptyStateMessage(null);
  assert.match(msg, /Nema dostupnih cena konkurencije za ovaj datum/);
});

test("quota-exceeded keeps its own distinct message, separate from both of the above", () => {
  const msg = competitorEmptyStateMessage("quota_exceeded");
  assert.match(msg, /mesečni limit/i);
  assert.doesNotMatch(msg, /nije podešena/);
  assert.doesNotMatch(msg, /Nema dostupnih cena konkurencije za ovaj datum/);
});

test("all three messages are distinct from one another", () => {
  const messages = [
    competitorEmptyStateMessage("quota_exceeded"),
    competitorEmptyStateMessage("not_configured"),
    competitorEmptyStateMessage(null),
  ];
  assert.equal(new Set(messages).size, 3);
});
