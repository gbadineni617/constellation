import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Static checks on the API routes.
 *
 * These exist because a route can be broken in ways that compile, pass every
 * other test, and only fail once deployed. One of them shipped: a handler that
 * called authorised(req) while declaring `GET()` with no parameter, which threw
 * on its first line and returned a 500 for every request.
 */

const routes = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name === "route.js") routes.push(p);
  }
})("app/api");

const HANDLER = /export (?:async )?function (GET|POST|PUT|DELETE|PATCH|OPTIONS)\(([^)]*)\)\s*\{/g;

const handlers = () =>
  routes.flatMap((path) => {
    const src = readFileSync(path, "utf8");
    const found = [];
    for (const m of src.matchAll(HANDLER)) {
      const start = m.index + m[0].length;
      const next = src.indexOf("\nexport ", start);
      found.push({
        path,
        verb: m[1],
        params: m[2].trim(),
        body: src.slice(start, next > 0 ? next : src.length),
        src,
      });
    }
    return found;
  });

test("there are routes to check", () => {
  assert.ok(routes.length >= 8, "found " + routes.length + " routes");
});

test("a handler that uses req declares it", () => {
  for (const h of handlers()) {
    if (!/\breq\b/.test(h.body)) continue;
    assert.match(
      h.params, /^req\b/,
      h.path + " " + h.verb + "() uses req but declares (" + h.params + ") — it will throw on the first line"
    );
  }
});

test("every route answers the CORS pre-flight", () => {
  for (const path of routes) {
    const src = readFileSync(path, "utf8");
    assert.match(src, /export (?:async )?function OPTIONS/, path + " has no OPTIONS handler, so a custom app cannot call it");
  }
});

test("no route returns Response.json directly — CORS headers would be missing", () => {
  for (const path of routes) {
    const src = readFileSync(path, "utf8");
    assert.ok(
      !/\bResponse\.json\(/.test(src),
      path + " uses Response.json; use json(req, ...) from lib/cors so the response carries CORS headers"
    );
  }
});

test("every data handler is behind the auth gate", () => {
  for (const h of handlers()) {
    if (h.verb === "OPTIONS") continue;   // pre-flight must answer before auth
    assert.match(
      h.body, /authorised\(req\)/,
      h.path + " " + h.verb + " does not check authorised(req) — it would be open on a public URL"
    );
  }
});

test("routes import what they use", () => {
  for (const path of routes) {
    const src = readFileSync(path, "utf8");
    for (const fn of ["json", "preflight", "authorised", "unauthorised"]) {
      if (new RegExp("\\b" + fn + "\\(").test(src)) {
        assert.match(src, new RegExp("import \\{[^}]*\\b" + fn + "\\b"), path + " uses " + fn + " without importing it");
      }
    }
  }
});
