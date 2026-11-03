/** Local-only fault injection for the session probe; all other traffic reaches the real portal. */
import http from "node:http";

const listenPort = Number(process.env.SESSION_SYNC_FAULT_PROXY_PORT ?? "3004");
const portalPort = Number(process.env.SESSION_SYNC_PORTAL_UPSTREAM_PORT ?? "3003");
const marketingOrigin = process.env.SESSION_SYNC_MARKETING_URL ?? "http://denali.localhost:3002";
const modes = new Set(["normal", "error", "invalid", "offline", "hold", "ready"]);
let mode = "normal";
const held = [];
let heldMarkedCount = 0;

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://local-test").pathname;
  if (req.method === "GET" && req.url === "/__session_sync_test/health") {
    res.end("ok");
    return;
  }
  if (req.method === "GET" && req.url === "/__session_sync_test/held") {
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ count: held.length, marked: heldMarkedCount }));
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/__session_sync_test/mode/")) {
    const selected = req.url.slice("/__session_sync_test/mode/".length);
    if (!modes.has(selected)) {
      res.writeHead(400).end();
      return;
    }
    mode = selected;
    if (mode === "normal") {
      for (const reply of held.splice(0)) reply();
      heldMarkedCount = 0;
    }
    res.writeHead(204).end();
    return;
  }
  if (
    req.method === "GET" &&
    pathname === "/api/public-auth/session" &&
    mode !== "normal" &&
    mode !== "hold"
  ) {
    if (mode === "offline") {
      req.socket.destroy();
      return;
    }
    res.writeHead(mode === "error" ? 503 : 200, {
      "access-control-allow-origin": marketingOrigin,
      "access-control-allow-credentials": "true",
      "cache-control": "no-store",
      "content-type": "application/json",
      vary: "Origin",
    });
    res.end(
      mode === "error"
        ? '{"ok":false}'
        : mode === "ready"
          ? '{"ok":true,"ready":true}'
          : '{"ok":true,"ready":"false"}'
    );
    return;
  }
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: portalPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (response) => {
      if (pathname === "/api/public-auth/session" && mode === "hold") {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          if (req.url?.includes("session_sync_test=late")) heldMarkedCount += 1;
          held.push(() => {
            if (res.destroyed) return;
            res.writeHead(response.statusCode ?? 502, response.headers);
            res.end(Buffer.concat(chunks));
          });
        });
        return;
      }
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    }
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
});
server.listen(listenPort, "127.0.0.1");
