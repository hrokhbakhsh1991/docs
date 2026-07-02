#!/usr/bin/env node
/**
 * SEO-5++ — crawl marketing sitemap.xml for host-aware URL hygiene.
 */
import http from "node:http";
import https from "node:https";

function parseArgs(argv) {
  const args = { host: "shop.operator.localhost:3002", path: "/sitemap.xml" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--smoke-host" && argv[i + 1]) {
      args.host = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function fetchText(url) {
  const client = url.startsWith("https:") ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.on("error", reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

async function main() {
  const { host } = parseArgs(process.argv.slice(2));
  const url = `http://${host}/sitemap.xml`;
  const errors = [];

  let response;
  try {
    response = await fetchText(url);
  } catch (error) {
    console.error(`crawl-marketing-sitemap: FAIL — could not fetch ${url} (${String(error)})`);
    console.error("Start marketing smoke servers or pass --smoke-host <host:port>");
    process.exit(1);
  }

  if (response.status !== 200) {
    errors.push(`expected HTTP 200, got ${response.status}`);
  }

  const body = response.body;
  if (!/<urlset[\s>]/i.test(body)) {
    errors.push("missing <urlset>");
  }

  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (locs.length === 0) {
    errors.push("no <loc> entries");
  }

  for (const loc of locs) {
    if (loc.includes("?")) {
      errors.push(`query string in sitemap URL: ${loc}`);
    }
    if (!loc.includes(host.split(":")[0] ?? host)) {
      errors.push(`off-origin sitemap URL: ${loc}`);
    }
  }

  if (errors.length > 0) {
    console.error("crawl-marketing-sitemap: FAIL");
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log(`crawl-marketing-sitemap: PASS (${locs.length} URLs @ ${url})`);
}

main();
