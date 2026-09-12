/**
 * App Router not-found/global-error — avoids Pages Router status prerender (next/document Html).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("app-not-found.spec.ts", () => {
  it("root not-found uses App Router surface and page-missing copy", () => {
    const source = readWeb("app/not-found.tsx");
    assert.match(source, /getTranslations\("common\.pageNotFound"\)/);
    assert.match(source, /data-web-page-not-found/);
    assert.match(source, /data-web-not-found/);
    assert.doesNotMatch(source, /from ["']next\/document["']/);
    assert.doesNotMatch(source, /<Html\b/);
  });

  it("global-error defines html/body without next/document", () => {
    const source = readWeb("app/global-error.tsx");
    assert.match(source, /"use client"/);
    assert.match(source, /data-web-global-error/);
    assert.match(source, /<html/);
    assert.match(source, /<body/);
    assert.doesNotMatch(source, /from ["']next\/document["']/);
    assert.doesNotMatch(source, /<Html\b/);
  });

  it("pages _error stub disables built-in /_error Html export path", () => {
    const source = readWeb("pages/_error.tsx");
    assert.match(source, /data-web-pages-error/);
    assert.match(source, /getInitialProps/);
    assert.doesNotMatch(source, /from ["']next\/document["']/);
    assert.doesNotMatch(source, /<Html\b/);
  });
});
