import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { launchDesktop, HANDOFF_TOKEN_PATTERN } from "./desktop-launch.mjs";

export const GAME_VERSION = "1.3.0";
export const MAX_HANDOFF_BYTES = 2 * 1024 * 1024;
export const HANDOFF_TTL_MS = 120000;
const DEFAULT_BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
};
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const reply = (res, status, body) => res.writeHead(status, jsonHeaders).end(JSON.stringify(body));

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function readJSON(req) {
  const length = req.headers["content-length"];
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_HANDOFF_BYTES)) {
    req.resume();
    return Promise.reject(new RequestError(413, "Sauvegarde trop volumineuse (maximum 2 Mio)."));
  }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "") ||
      (req.headers["content-encoding"] && req.headers["content-encoding"] !== "identity")) {
    req.resume();
    return Promise.reject(new RequestError(415, "Un document JSON non compressé est requis."));
  }
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    const cleanup = () => {
      req.off("data", data);
      req.off("end", end);
      req.off("error", error);
      req.off("aborted", aborted);
    };
    const fail = (reason) => { cleanup(); req.on("error", () => {}); req.resume(); reject(reason); };
    const data = (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_HANDOFF_BYTES) {
        fail(new RequestError(413, "Sauvegarde trop volumineuse (maximum 2 Mio)."));
        return;
      }
      chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      try { resolve(JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"))); }
      catch { reject(new RequestError(400, "Document JSON invalide.")); }
    };
    const error = () => fail(new RequestError(400, "Lecture de la sauvegarde interrompue."));
    const aborted = () => fail(new RequestError(400, "Transfert interrompu."));
    req.on("data", data);
    req.once("end", end);
    req.once("error", error);
    req.once("aborted", aborted);
  });
}

/** A loopback-only static server. Save transfers stay in this process's memory. */
export function createGameServer({ base = DEFAULT_BASE, launcher = launchDesktop, now = Date.now, version = GAME_VERSION } = {}) {
  const root = path.resolve(base);
  const transfers = new Map();
  const prune = () => {
    const time = now();
    for (const [token, entry] of transfers) if (entry.expires <= time) transfers.delete(token);
  };
  const expiryTimer = setInterval(prune, 15000);
  expiryTimer.unref();
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const port = server.address()?.port;
    const origin = `http://127.0.0.1:${port}`;
    let url, decoded;
    try {
      url = new URL(req.url, origin);
      decoded = decodeURIComponent(url.pathname);
      if (decoded.includes("\0")) throw new Error("Invalid path");
    } catch {
      reply(res, 400, { error: "Adresse invalide." });
      return;
    }
    if (decoded.startsWith("/api/")) {
      prune();
      // Require the actual loopback host even if a foreign domain resolves locally.
      if (req.headers.host !== `127.0.0.1:${port}` ||
          (req.headers.origin !== undefined && req.headers.origin !== origin) ||
          req.headers["sec-fetch-site"] === "cross-site") {
        req.resume(); reply(res, 403, { error: "Cette action est réservée au jeu local." }); return;
      }
      if (decoded === "/api/launch-desktop") {
        if (req.method !== "POST") {
          req.resume(); res.setHeader("Allow", "POST"); reply(res, 405, { error: "Utilisez POST." }); return;
        }
        if (req.headers.origin !== origin) {
          req.resume(); reply(res, 403, { error: "L’origine du jeu local est requise." }); return;
        }
        try {
          const body = await readJSON(req);
          if (!body || typeof body !== "object" || Array.isArray(body) ||
              Object.keys(body).length !== 1 || !Object.hasOwn(body, "save") ||
              (body.save !== null && (typeof body.save !== "object" || Array.isArray(body.save)))) {
            throw new RequestError(400, "Le document doit contenir uniquement une sauvegarde objet ou null.");
          }
          // Bounded memory even if a local page sends many abandoned transfers.
          if (transfers.size >= 16) throw new RequestError(429, "Trop de transferts en attente. Réessayez dans deux minutes.");
          const token = randomBytes(32).toString("base64url");
          transfers.set(token, { save: body.save, expires: now() + HANDOFF_TTL_MS });
          try {
            const opened = await launcher({ port, token });
            reply(res, 200, { opened: true, browser: opened.browser, mode: opened.mode, message: opened.message });
          } catch {
            transfers.delete(token);
            reply(res, 503, { error: "Impossible d’ouvrir le navigateur. Lancez Lancer-Minecrack.cmd depuis le dossier du jeu." });
          }
        } catch (error) {
          if (!res.destroyed && !res.writableEnded)
            reply(res, error.status || 500, { error: error.status ? error.message : "Le transfert n’a pas pu être préparé." });
        }
        return;
      }
      if (decoded === "/api/handoff") {
        if (req.method !== "GET") {
          req.resume(); res.setHeader("Allow", "GET"); reply(res, 405, { error: "Utilisez GET." }); return;
        }
        const token = url.searchParams.get("token");
        const entry = typeof token === "string" && HANDOFF_TOKEN_PATTERN.test(token) ? transfers.get(token) : null;
        if (!entry) { reply(res, 404, { error: "Ce transfert est introuvable, expiré ou déjà utilisé." }); return; }
        transfers.delete(token); // Atomic before sending: concurrent reads cannot replay it.
        reply(res, 200, { save: entry.save });
        return;
      }
      req.resume(); reply(res, 404, { error: "Action introuvable." }); return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      req.resume(); res.setHeader("Allow", "GET, HEAD"); reply(res, 405, { error: "Méthode non autorisée." }); return;
    }
    if (decoded === "/health") {
      reply(res, 200, { game: "Minecrack", version, desktopLaunch: true });
      return;
    }
    const file = path.resolve(root, "." + (decoded === "/" ? "/index.html" : decoded));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end(); return;
    }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404).end("Introuvable"); return; }
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      if (req.method === "HEAD") { res.end(); return; }
      const stream = fs.createReadStream(file);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    });
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.once("close", () => { clearInterval(expiryTimer); transfers.clear(); });
  return server;
}

async function openDesktop(port) {
  if (!process.argv.includes("--open")) return;
  try {
    const result = await launchDesktop({ port });
    console.log(result.message);
  } catch (error) {
    console.error(`Ouverture automatique impossible : ${error.message}\nOuvrez http://127.0.0.1:${port}/ dans Chrome ou Edge.`);
  }
}

export function main() {
  const port = Number(process.env.PORT || 5194);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Le port local doit être un entier entre 1 et 65535."); process.exitCode = 1; return;
  }
  if (!fs.existsSync(path.join(DEFAULT_BASE, "index.html"))) {
    console.error("Build absent. Lancez npm run build."); process.exitCode = 1; return;
  }
  const server = createGameServer();
  server.on("error", (error) => {
    if (error.code !== "EADDRINUSE") {
      console.error(error.message); server.close(); process.exitCode = 1; return;
    }
    const request = http.get(`http://127.0.0.1:${port}/health`, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; if (body.length > 8192) request.destroy(); });
      response.on("end", async () => {
        let existing;
        try { existing = JSON.parse(body); } catch {}
        if (existing?.game === "Minecrack" && existing.version === GAME_VERSION && existing.desktopLaunch) {
          await openDesktop(port); server.close();
        } else {
          console.error(existing?.game === "Minecrack" ? "Fermez l’ancien lanceur Minecrack, puis relancez cette version." : `Port ${port} occupé par un autre programme.`);
          server.close(); process.exitCode = 1;
        }
      });
    });
    request.setTimeout(2500, () => request.destroy());
    request.on("error", () => { server.close(); process.exitCode = 1; });
  });
  server.listen(port, "127.0.0.1", async () => {
    console.log(`Minecrack : http://127.0.0.1:${port}/\nFermez cette fenêtre pour arrêter le serveur.`);
    await openDesktop(port);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
