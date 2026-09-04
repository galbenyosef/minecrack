import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter, once } from "node:events";
import { createGameServer, MAX_HANDOFF_BYTES, HANDOFF_TTL_MS } from "../scripts/serve.mjs";
import { desktopGameURL, findDesktopBrowser, launchDesktop } from "../scripts/desktop-launch.mjs";

async function fixture(t, { launcher } = {}) {
  const calls = [];
  let clock = 1000;
  const server = createGameServer({
    now: () => clock,
    launcher: launcher || (async (request) => {
      calls.push(request);
      return { browser: "Google Chrome", mode: "app", message: "Fenêtre ouverte." };
    }),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const post = (save, headers = {}) => fetch(`${origin}/api/launch-desktop`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ save }),
  });
  return { server, port, origin, calls, post, advance: (ms) => { clock += ms; } };
}

function rawRequest(url, { method = "POST", headers = {}, chunks = [] } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, headers }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: text }));
    });
    request.on("error", reject);
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

test("desktop transfer preserves the save once, uses the bound loopback port and never returns a token in POST", async (t) => {
  const f = await fixture(t);
  const save = { version: 1, seed: "MINECRACK", player: { position: [1, 8, 2] }, inventory: { counts: { ore: 17 } } };
  const response = await f.post(save);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(await response.json(), { opened: true, browser: "Google Chrome", mode: "app", message: "Fenêtre ouverte." });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].port, f.port);
  assert.match(f.calls[0].token, /^[A-Za-z0-9_-]{43}$/);
  const url = `${f.origin}/api/handoff?token=${f.calls[0].token}`;
  const taken = await fetch(url);
  assert.equal(taken.status, 200);
  assert.equal(taken.headers.get("cache-control"), "no-store");
  assert.equal(taken.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(await taken.json(), { save });
  assert.equal((await fetch(url)).status, 404);
});

test("launch rejects absent/foreign/null origins and foreign hosts without CORS or launching", async (t) => {
  const f = await fixture(t);
  for (const origin of [undefined, "null", "https://example.com", `http://localhost:${f.port}`, `http://127.0.0.1:${f.port + 1}`]) {
    const headers = { "Content-Type": "application/json" };
    if (origin !== undefined) headers.Origin = origin;
    const response = await fetch(`${f.origin}/api/launch-desktop`, { method: "POST", headers, body: '{"save":null}' });
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  const rebinding = await rawRequest(`${f.origin}/api/launch-desktop`, {
    headers: { Host: `attacker.example:${f.port}`, Origin: f.origin, "Content-Type": "application/json" },
    chunks: ['{"save":null}'],
  });
  assert.equal(rebinding.status, 403);
  const preflight = await fetch(`${f.origin}/api/launch-desktop`, { method: "OPTIONS", headers: { Origin: "https://example.com", "Access-Control-Request-Method": "POST" } });
  assert.equal(preflight.status, 403);
  assert.equal(preflight.headers.get("access-control-allow-origin"), null);
  assert.equal(f.calls.length, 0);
});

test("a cross-origin handoff read cannot consume the token", async (t) => {
  const f = await fixture(t);
  await f.post(null);
  const url = `${f.origin}/api/handoff?token=${f.calls[0].token}`;
  assert.equal((await fetch(url, { headers: { Origin: "https://example.com" } })).status, 403);
  assert.equal((await fetch(url, { headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { save: null });
});

test("handoffs expire at exactly two minutes and concurrent reads yield one winner", async (t) => {
  const f = await fixture(t);
  await f.post({ seed: "expired" });
  const expired = f.calls[0].token;
  f.advance(HANDOFF_TTL_MS);
  assert.equal((await fetch(`${f.origin}/api/handoff?token=${expired}`)).status, 404);
  await f.post({ seed: "fresh" });
  const fresh = f.calls[1].token;
  assert.notEqual(fresh, expired);
  const responses = await Promise.all([0, 1].map(() => fetch(`${f.origin}/api/handoff?token=${fresh}`)));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 404]);
  for (const token of ["", "wrong", "../../private", "A".repeat(43)])
    assert.equal((await fetch(`${f.origin}/api/handoff?token=${encodeURIComponent(token)}`)).status, 404);
});

test("JSON shape and content type reject arbitrary URLs, commands, arrays and malformed payloads", async (t) => {
  const f = await fixture(t);
  for (const body of ["null", "[]", "{}", '{"save":[]}', '{"save":"file"}', '{"save":null,"url":"https://example.com"}', '{"save":null,"command":"calc.exe"}', "not json"]) {
    const response = await fetch(`${f.origin}/api/launch-desktop`, {
      method: "POST", headers: { Origin: f.origin, "Content-Type": "application/json" }, body,
    });
    assert.equal(response.status, 400, body);
  }
  assert.equal((await f.post(null, { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await f.post(null, { "Content-Encoding": "gzip" })).status, 415);
  assert.equal((await fetch(`${f.origin}/api/launch-desktop`)).status, 405);
  assert.equal((await fetch(`${f.origin}/api/handoff`, { method: "POST", headers: { Origin: f.origin } })).status, 405);
  assert.equal(f.calls.length, 0);
});

test("the 2 MiB limit applies to declared and chunked bodies, measured in bytes", async (t) => {
  const f = await fixture(t);
  const url = `${f.origin}/api/launch-desktop`;
  const headers = { Origin: f.origin, "Content-Type": "application/json" };
  const declared = await rawRequest(url, { headers: { ...headers, "Content-Length": String(MAX_HANDOFF_BYTES + 1) }, chunks: ["a".repeat(MAX_HANDOFF_BYTES + 1)] });
  assert.equal(declared.status, 413);
  const chunked = await rawRequest(url, {
    headers,
    chunks: ['{"save":{"data":"', "é".repeat(MAX_HANDOFF_BYTES / 2), '"}}'],
  });
  assert.equal(chunked.status, 413);
  assert.equal(f.calls.length, 0);
  const exact = '{"save":{"data":"' + "a".repeat(MAX_HANDOFF_BYTES - 20) + '"}}';
  assert.equal(Buffer.byteLength(exact), MAX_HANDOFF_BYTES);
  const accepted = await rawRequest(url, { headers, chunks: [exact] });
  assert.equal(accepted.status, 200);
  assert.equal(f.calls.length, 1);
});

test("failed browser spawn removes its transfer and leaves the server usable", async (t) => {
  const attempted = [];
  const f = await fixture(t, { launcher: async (request) => { attempted.push(request); throw new Error("spawn failed"); } });
  const response = await f.post({ seed: "retry" });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Impossible d’ouvrir/);
  assert.equal((await fetch(`${f.origin}/api/handoff?token=${attempted[0].token}`)).status, 404);
  const health = await fetch(`${f.origin}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).desktopLaunch, true);
});

test("desktop launcher chooses a known executable and sends app mode as literal spawn arguments", async () => {
  const env = { ProgramFiles: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\Player\\AppData\\Local" };
  const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const calls = [];
  let unref = 0;
  const spawn = (...args) => {
    calls.push(args);
    const child = new EventEmitter(); child.unref = () => { unref++; };
    queueMicrotask(() => child.emit("spawn"));
    return child;
  };
  const result = await launchDesktop({ port: 5194, token: "A".repeat(43) }, { platform: "win32", env, exists: (file) => file === chrome, spawn });
  assert.equal(result.mode, "app");
  assert.equal(result.browser, "Google Chrome");
  assert.deepEqual(calls[0], [chrome, [`--app=http://127.0.0.1:5194/?handoff=${"A".repeat(43)}`, "--no-first-run"], { detached: true, stdio: "ignore", windowsHide: true, shell: false }]);
  assert.equal(unref, 1);
  const edge = findDesktopBrowser({ platform: "win32", env, exists: (file) => file.endsWith("Microsoft\\Edge\\Application\\msedge.exe") });
  assert.equal(edge.browser, "Microsoft Edge");
  assert.equal(desktopGameURL(5194), "http://127.0.0.1:5194/");
  for (const port of [0, -1, 65536, "5194", NaN]) assert.throws(() => desktopGameURL(port));
  for (const token of ["https://example.com", "--user-data-dir=other", 'x" & calc.exe', "../../path"]) assert.throws(() => desktopGameURL(5194, token));
});

test("missing Chrome/Edge falls back explicitly, while spawn failures are reported", async () => {
  const calls = [];
  const spawn = (...args) => {
    calls.push(args);
    const child = new EventEmitter(); child.unref = () => {};
    queueMicrotask(() => child.emit("spawn"));
    return child;
  };
  const result = await launchDesktop({ port: 5194 }, { platform: "win32", env: {}, exists: () => false, spawn });
  assert.equal(result.mode, "browser");
  assert.match(result.message, /n’ont pas été détectés/);
  assert.deepEqual(calls[0][1], ["url.dll,FileProtocolHandler", "http://127.0.0.1:5194/"]);
  await assert.rejects(launchDesktop({ port: 5194 }, {
    platform: "win32", env: {}, exists: () => false,
    spawn: () => { const child = new EventEmitter(); child.unref = () => {}; queueMicrotask(() => child.emit("error", new Error("denied"))); return child; },
  }), /denied/);
});
