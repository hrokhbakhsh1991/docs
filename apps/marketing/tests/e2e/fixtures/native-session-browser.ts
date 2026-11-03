import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Native tab visibility: Playwright's usual focus override keeps background pages visible. */
export async function openNativeSessionBrowser(outputDir: string) {
  await mkdir(outputDir, { recursive: true });
  const profile = await mkdtemp(join(resolve(outputDir), "native-browser-"));
  const child = spawn(
    process.env.SESSION_SYNC_NATIVE_BROWSER_EXECUTABLE ?? chromium.executablePath(),
    [
      "--remote-debugging-port=0",
      "--remote-debugging-address=127.0.0.1",
      "--no-first-run",
      "--no-default-browser-check",
      // Same OS sandbox setting as Playwright. Cookie/CORS/TLS security stays enabled.
      "--no-sandbox",
      `--user-data-dir=${profile}`,
      ...(process.env.SESSION_SYNC_HOST_RESOLVER_RULES
        ? [`--host-resolver-rules=${process.env.SESSION_SYNC_HOST_RESOLVER_RULES}`]
        : []),
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  let launchError: Error | undefined;
  child.once("error", (error) => {
    launchError = error;
  });
  const exited = once(child, "exit").catch(() => undefined);
  const cleanup = async () => {
    child.kill("SIGTERM");
    await exited;
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  try {
    let port: string | undefined;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw new Error(`Native browser exited: ${child.exitCode}`);
      try {
        port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
        break;
      } catch {
        await new Promise((done) => setTimeout(done, 100));
      }
    }
    if (!port) throw new Error("Native browser did not expose its loopback CDP endpoint");
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
    return {
      context: browser.contexts()[0]!,
      async close() {
        await browser.close();
        await cleanup();
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
