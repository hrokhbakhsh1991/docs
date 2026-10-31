import net from "node:net";

const allowedHosts = new Set([
  "denali.staging.test",
  "admin.denali.staging.test",
  "portal.denali.staging.test",
  "qa2.staging.test",
  "admin.qa2.staging.test",
  "portal.qa2.staging.test",
]);
const upstreamPort = Number(process.env.DENALI_SECOND_STAGING_UPSTREAM_PORT ?? "18443");
const listenPort = Number(process.env.DENALI_SECOND_STAGING_PROXY_PORT ?? "9443");
if (upstreamPort !== 18443 || listenPort !== 9443) {
  throw new Error("S2_E12_PROXY_PORT_POLICY_REJECTED");
}

const server = net.createServer((client) => {
  client.setTimeout(10_000);
  let header = Buffer.alloc(0);
  const onData = (chunk) => {
    header = Buffer.concat([header, chunk]);
    if (header.length > 16_384) {
      client.destroy();
      return;
    }
    const end = header.indexOf("\r\n\r\n");
    if (end < 0) return;
    client.off("data", onData);
    const firstLine = header.subarray(0, end).toString("latin1").split("\r\n", 1)[0] ?? "";
    const match = /^CONNECT ([a-z0-9.-]+):443 HTTP\/1\.[01]$/i.exec(firstLine);
    const hostname = match?.[1]?.toLowerCase();
    if (!hostname || !allowedHosts.has(hostname)) {
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    const upstream = net.connect(upstreamPort, "127.0.0.1", () => {
      client.setTimeout(0);
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      const remainder = header.subarray(end + 4);
      if (remainder.length > 0) upstream.write(remainder);
      client.pipe(upstream);
      upstream.pipe(client);
    });
    upstream.on("error", () => client.destroy());
    client.on("error", () => upstream.destroy());
    client.on("close", () => upstream.destroy());
  };
  client.on("data", onData);
  client.on("timeout", () => client.destroy());
});

server.listen(listenPort, "127.0.0.1", () => {
  process.stdout.write(`S2_E12_PROXY_LISTENING 127.0.0.1:${listenPort}\n`);
});
