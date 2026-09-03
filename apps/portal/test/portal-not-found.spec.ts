/**
 * App Router not-found — avoids Pages Router /404 prerender (next/document Html).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readPortal(relativePath: string): string {
  return readFileSync(join(portalRoot, relativePath), "utf8");
}

describe("portal-not-found.spec.ts", () => {
  it("root not-found uses App Router surface and page-missing copy", () => {
    const source = readPortal("app/not-found.tsx");
    assert.match(source, /getTranslations\("common\.pageNotFound"\)/);
    assert.match(source, /data-portal-page-not-found/);
    assert.match(source, /data-portal-not-found/);
    assert.doesNotMatch(source, /from ["']next\/document["']/);
    assert.doesNotMatch(source, /<Html\b/);
  });

  it("global-error defines html/body without next/document", () => {
    const source = readPortal("app/global-error.tsx");
    assert.match(source, /"use client"/);
    assert.match(source, /data-portal-global-error/);
    assert.match(source, /<html/);
    assert.match(source, /<body/);
    assert.doesNotMatch(source, /from ["']next\/document["']/);
    assert.doesNotMatch(source, /<Html\b/);
  });

  it("pages _error stub disables built-in /_error Html export path", () => {
    const source = readPortal("pages/_error.tsx");
    assert.match(source, /data-portal-pages-error/);
    assert.match(source, /getInitialProps/);
    assert.doesNotMatch(source, /from ["']next\/document["']/);
    assert.doesNotMatch(source, /<Html\b/);
  });
});
