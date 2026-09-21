#!/usr/bin/env node
/**
 * A07 runtime evidence for the A01 `/v1` backend proxy rewrite.
 *
 * Assumes a production build exists (`.next/BUILD_ID`) compiled with
 * `BUNGAE_API_ORIGIN` pointing at the smoke upstream. The script then:
 *   1. starts a disposable HTTP upstream on 127.0.0.1:18091,
 *   2. starts `next start` on 127.0.0.1:3122 with BUNGAE_API_ORIGIN set,
 *   3. waits for readiness by polling (no fixed sleep),
 *   4. POSTs JSON to /v1/auth/otp-requests?probe=1, and
 *   5. asserts the upstream observed the preserved method, the rewritten
 *      /api/v1/... path + query, the intact body, and that its marker
 *      status (207) and header round-tripped through the proxy.
 *
 * Everything the script owns is torn down on success, failure, SIGINT, and
 * SIGTERM. Busy ports and child exit-before-ready fail fast with buffered
 * child logs.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deepStrictEqual } from "node:assert";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const UPSTREAM_PORT = 18091;
const APP_PORT = 3122;
const UPSTREAM_ORIGIN = `http://${HOST}:${UPSTREAM_PORT}`;
const APP_ORIGIN = `http://${HOST}:${APP_PORT}`;

const MARKER = "bungae-api-proxy-smoke";
const UPSTREAM_STATUS = 207;
const PROBE_PATH = "/v1/auth/otp-requests";
const PROBE_QUERY = "probe=1";
const EXPECTED_UPSTREAM_URL = `/api/v1/auth/otp-requests?${PROBE_QUERY}`;
const REQUEST_BODY = { phone: "+821012345678", channel: "sms", marker: MARKER };

const OVERALL_TIMEOUT_MS = 90_000;
const READY_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 250;
const KILL_GRACE_MS = 3_000;
const MAX_LOG_CHARS = 64_000;

const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (err) => {
      reject(
        new Error(
          `${HOST}:${port} is already in use (${err.code ?? err.message}); free the port and retry`,
        ),
      );
    });
    probe.once("listening", () => probe.close(() => resolve()));
    probe.listen(port, HOST);
  });
}

async function main() {
  if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    throw new Error(
      "no production build found (.next/BUILD_ID missing); run " +
        `\`BUNGAE_API_ORIGIN=${UPSTREAM_ORIGIN} npm run build\` first`,
    );
  }
  if (!existsSync(NEXT_BIN)) {
    throw new Error("next binary not found; run `npm ci` first");
  }

  // Fail fast on busy ports before owning any resources.
  await assertPortFree(UPSTREAM_PORT);
  await assertPortFree(APP_PORT);

  // --- disposable upstream --------------------------------------------------
  const sockets = new Set();
  const upstream = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      res.writeHead(UPSTREAM_STATUS, {
        "content-type": "application/json",
        "x-bungae-proxy-smoke": "upstream",
      });
      res.end(
        JSON.stringify({
          marker: MARKER,
          seen: {
            method: req.method,
            url: req.url,
            contentType: req.headers["content-type"] ?? null,
            body: parsed,
          },
        }),
      );
    });
  });
  upstream.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    upstream.once("error", (err) =>
      reject(
        new Error(
          `upstream failed to bind ${HOST}:${UPSTREAM_PORT} (${err.code ?? err.message})`,
        ),
      ),
    );
    upstream.once("listening", resolve);
    upstream.listen(UPSTREAM_PORT, HOST);
  });
  state.upstream = upstream;
  state.sockets = sockets;

  // --- next start -----------------------------------------------------------
  const child = spawn(
    process.execPath,
    [NEXT_BIN, "start", "--hostname", HOST, "--port", String(APP_PORT)],
    {
      cwd: ROOT,
      env: { ...process.env, BUNGAE_API_ORIGIN: UPSTREAM_ORIGIN },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  state.child = child;
  child.stdout.on("data", (chunk) => appendChildLog(chunk));
  child.stderr.on("data", (chunk) => appendChildLog(chunk));
  let childExit = null;
  child.once("exit", (code, signal) => {
    childExit = { code, signal };
  });

  // --- readiness polling ----------------------------------------------------
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let ready = false;
  while (Date.now() < deadline) {
    if (childExit) {
      throw new Error(
        `next start exited before becoming ready ` +
          `(code=${childExit.code} signal=${childExit.signal})`,
      );
    }
    try {
      const res = await fetch(`${APP_ORIGIN}/`, {
        signal: AbortSignal.timeout(2_000),
      });
      await res.arrayBuffer();
      ready = true;
      break;
    } catch {
      await sleep(POLL_INTERVAL_MS);
    }
  }
  if (!ready) {
    throw new Error(
      `next start did not become ready on ${APP_ORIGIN} within ${READY_TIMEOUT_MS}ms`,
    );
  }

  // --- proxied request ------------------------------------------------------
  const res = await fetch(`${APP_ORIGIN}${PROBE_PATH}?${PROBE_QUERY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(REQUEST_BODY),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await res.json();

  const problems = [];
  if (res.status !== UPSTREAM_STATUS) {
    problems.push(`expected upstream status ${UPSTREAM_STATUS}, got ${res.status}`);
  }
  if (res.headers.get("x-bungae-proxy-smoke") !== "upstream") {
    problems.push("missing upstream marker header x-bungae-proxy-smoke");
  }
  if (payload?.marker !== MARKER) {
    problems.push(`expected marker ${JSON.stringify(MARKER)} in proxied body`);
  }
  const seen = payload?.seen ?? {};
  if (seen.method !== "POST") {
    problems.push(`expected method POST upstream, got ${JSON.stringify(seen.method)}`);
  }
  if (seen.url !== EXPECTED_UPSTREAM_URL) {
    problems.push(
      `expected rewritten url ${EXPECTED_UPSTREAM_URL}, got ${JSON.stringify(seen.url)}`,
    );
  }
  if (!String(seen.contentType ?? "").startsWith("application/json")) {
    problems.push(`expected JSON content-type upstream, got ${JSON.stringify(seen.contentType)}`);
  }
  try {
    deepStrictEqual(seen.body, REQUEST_BODY);
  } catch {
    problems.push(`request body was not preserved (upstream saw ${JSON.stringify(seen.body)})`);
  }
  if (problems.length > 0) {
    throw new Error(`proxy assertions failed:\n  - ${problems.join("\n  - ")}`);
  }

  console.log(
    `api-proxy-smoke: PASS — POST ${PROBE_PATH}?${PROBE_QUERY} -> ` +
      `${UPSTREAM_STATUS} from ${UPSTREAM_ORIGIN}${EXPECTED_UPSTREAM_URL}`,
  );
}

// --- shared state + cleanup --------------------------------------------------
const state = { upstream: null, sockets: null, child: null };
let childLog = "";
let cleaningUp = false;

function appendChildLog(chunk) {
  childLog += chunk.toString("utf8");
  if (childLog.length > MAX_LOG_CHARS) childLog = childLog.slice(-MAX_LOG_CHARS);
}

function printChildLogs() {
  console.error("---- next start output ----");
  console.error(childLog.trim() || "(no output)");
  console.error("---------------------------");
}

async function cleanup() {
  if (cleaningUp) return;
  cleaningUp = true;
  const { child, upstream, sockets } = state;
  state.child = null;
  state.upstream = null;
  state.sockets = null;
  if (child && child.exitCode === null && !child.killed) {
    child.kill("SIGTERM");
    const exited = await Promise.race([
      once(child, "exit").then(() => true),
      sleep(KILL_GRACE_MS).then(() => false),
    ]);
    if (!exited) {
      child.kill("SIGKILL");
      await once(child, "exit").catch(() => {});
    }
  }
  if (upstream) {
    for (const socket of sockets ?? []) socket.destroy();
    await new Promise((resolve) => upstream.close(() => resolve()));
  }
}

let settled = false;
async function fail(err) {
  if (settled) return;
  settled = true;
  console.error(`api-proxy-smoke: FAIL — ${err.message}`);
  printChildLogs();
  await cleanup();
  process.exit(1);
}

for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.on(signal, () => {
    console.error(`api-proxy-smoke: received ${signal}, cleaning up`);
    void cleanup().finally(() => process.exit(code));
  });
}

const watchdog = setTimeout(() => {
  void fail(new Error(`timed out after ${OVERALL_TIMEOUT_MS}ms`));
}, OVERALL_TIMEOUT_MS);

try {
  await main();
  settled = true;
  clearTimeout(watchdog);
  await cleanup();
  process.exit(0);
} catch (err) {
  clearTimeout(watchdog);
  await fail(err);
}
