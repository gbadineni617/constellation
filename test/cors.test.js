import { test } from "node:test";
import assert from "node:assert/strict";
import { corsHeaders, authorised } from "../lib/cors.js";

const req = (origin, key, url = "https://x.vercel.app/api/journeys") => ({
  url,
  headers: {
    get: (h) => {
      const k = h.toLowerCase();
      if (k === "origin") return origin || null;
      if (k === "x-constellation-key") return key || null;
      return null;
    },
  },
});

test("a Smartcat origin is permitted", () => {
  for (const o of ["https://smartcat.ai", "https://us.smartcat.ai", "https://ea.smartcat.ai"]) {
    assert.equal(corsHeaders(req(o))["Access-Control-Allow-Origin"], o, o + " must be allowed");
  }
});

test("localhost is permitted, so a custom app can be developed locally", () => {
  assert.ok(corsHeaders(req("http://localhost:5173"))["Access-Control-Allow-Origin"]);
});

test("an unknown origin gets no CORS header at all", () => {
  const h = corsHeaders(req("https://not-smartcat.example"));
  assert.equal(h["Access-Control-Allow-Origin"], undefined,
    "an unrecognised origin is refused by omission, not by a wildcard");
  assert.deepEqual(h, {});
});

test("the wildcard is never used", () => {
  for (const o of ["https://smartcat.ai", "https://evil.example", ""]) {
    assert.notEqual(corsHeaders(req(o))["Access-Control-Allow-Origin"], "*",
      "a public URL with * is an open API");
  }
});

test("the response varies by origin, so a CDN cannot cache one origin's answer for another", () => {
  assert.equal(corsHeaders(req("https://smartcat.ai")).Vary, "Origin");
});

test("the custom header is declared, or the browser will strip it", () => {
  const h = corsHeaders(req("https://smartcat.ai"));
  assert.match(h["Access-Control-Allow-Headers"], /X-Constellation-Key/);
});

test("with no key configured, everything is allowed — local development is unaffected", () => {
  delete process.env.CONSTELLATION_KEY;
  assert.equal(authorised(req("https://smartcat.ai")), true);
});

test("with a key configured, it is required", () => {
  process.env.CONSTELLATION_KEY = "s3cret-value";
  assert.equal(authorised(req("https://smartcat.ai", "s3cret-value")), true);
  assert.equal(authorised(req("https://smartcat.ai", "wrong-value")), false);
  assert.equal(authorised(req("https://smartcat.ai", "")), false);
  assert.equal(authorised(req("https://smartcat.ai")), false, "absent is not the same as correct");
  delete process.env.CONSTELLATION_KEY;
});

test("a near-miss is still a miss", () => {
  process.env.CONSTELLATION_KEY = "abcdef";
  assert.equal(authorised(req("https://smartcat.ai", "abcdeg")), false, "one character out is out");
  assert.equal(authorised(req("https://smartcat.ai", "abcde")), false, "shorter is out");
  assert.equal(authorised(req("https://smartcat.ai", "abcdefg")), false, "longer is out");
  delete process.env.CONSTELLATION_KEY;
});

test("the key may travel as a query parameter, for links that cannot set headers", () => {
  process.env.CONSTELLATION_KEY = "qs-key";
  assert.equal(authorised(req("https://smartcat.ai", null, "https://x.app/api/journeys?key=qs-key")), true);
  assert.equal(authorised(req("https://smartcat.ai", null, "https://x.app/api/journeys?key=nope")), false);
  delete process.env.CONSTELLATION_KEY;
});
