import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

/**
 * Local-only TLS reverse proxy for R3 device testing.
 * It intentionally binds 127.0.0.1 and is NOT a public exposure mechanism.
 * Use a trusted certificate + HTTPS domain for a real WeChat device.
 */
const root = process.cwd();
const keyPath = process.env.TLS_KEY || path.join(root, ".local-tls/key.pem");
const certPath = process.env.TLS_CERT || path.join(root, ".local-tls/cert.pem");
const port = Number(process.env.TLS_PORT || 8443);
const targetPort = Number(process.env.TARGET_PORT || 4317);

const server = https.createServer(
  { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
  (req, res) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end("upstream unavailable");
    });
    req.pipe(upstream);
  },
);

server.listen(port, "127.0.0.1", () => {
  // No request bodies, cookies or tokens are logged.
  process.stdout.write(`local TLS proxy listening on https://127.0.0.1:${port}\n`);
});
