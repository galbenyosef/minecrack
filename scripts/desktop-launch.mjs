import fs from "node:fs";
import path from "node:path";
import { spawn as spawnProcess } from "node:child_process";

export const HANDOFF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Construct the only address this launcher is allowed to open. */
export function desktopGameURL(port, token = null) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new TypeError("Port local invalide.");
  if (token !== null && !HANDOFF_TOKEN_PATTERN.test(token))
    throw new TypeError("Jeton de transfert invalide.");
  return `http://127.0.0.1:${port}/${token === null ? "" : `?handoff=${token}`}`;
}

/** Known installation paths only: no path, command, URL or flags from the request. */
export function findDesktopBrowser({ platform = process.platform, env = process.env, exists = fs.existsSync } = {}) {
  let candidates = [];
  if (platform === "win32") {
    const roots = [...new Set([env.ProgramW6432, env.ProgramFiles, env["ProgramFiles(x86)"], env.LOCALAPPDATA].filter(Boolean))];
    for (const [browser, relative] of [
      ["Google Chrome", "Google/Chrome/Application/chrome.exe"],
      ["Microsoft Edge", "Microsoft/Edge/Application/msedge.exe"],
    ]) {
      for (const root of roots) candidates.push({ browser, executable: path.win32.join(root, relative) });
    }
  } else if (platform === "darwin") {
    candidates = [
      { browser: "Google Chrome", executable: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
      { browser: "Microsoft Edge", executable: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" },
    ];
  } else {
    candidates = [
      { browser: "Google Chrome", executable: "/usr/bin/google-chrome" },
      { browser: "Google Chrome", executable: "/usr/bin/google-chrome-stable" },
      { browser: "Microsoft Edge", executable: "/usr/bin/microsoft-edge" },
      { browser: "Microsoft Edge", executable: "/usr/bin/microsoft-edge-stable" },
    ];
  }
  return candidates.find(({ executable }) => exists(executable)) || null;
}

function startProcess(executable, args, spawn) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(executable, args, { detached: true, stdio: "ignore", windowsHide: true, shell: false });
    } catch (error) {
      reject(error);
      return;
    }
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

/** Open an ordinary external browser process, with no Node integration. */
export async function launchDesktop({ port, token = null }, {
  platform = process.platform,
  env = process.env,
  exists = fs.existsSync,
  spawn = spawnProcess,
} = {}) {
  const url = desktopGameURL(port, token);
  const browser = findDesktopBrowser({ platform, env, exists });
  if (browser) {
    await startProcess(browser.executable, [`--app=${url}`, "--no-first-run"], spawn);
    return { browser: browser.browser, mode: "app", message: `Minecrack s’ouvre dans une fenêtre ${browser.browser}. Cliquez sur Jouer pour capturer la souris.` };
  }
  const command = platform === "win32" ? "rundll32.exe" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  await startProcess(command, args, spawn);
  return {
    browser: "Navigateur par défaut",
    mode: "browser",
    message: "Chrome et Edge n’ont pas été détectés. Minecrack s’ouvre dans votre navigateur par défaut ; cliquez sur Jouer pour capturer la souris.",
  };
}
