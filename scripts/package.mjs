import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// Packaging is deliberately separate from build: run only after validating dist.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = path.resolve(root, "release");
const destination = path.resolve(releaseRoot, "Minecrack-Windows-v1.3");
const expectedNodeVersion = "v24.18.0";
const nodeLicenseSource =
  "https://raw.githubusercontent.com/nodejs/node/v24.18.0/LICENSE";
const nodeLicenseHash =
  "148eacf7863ef4329224a29398623077200a27194aa075569faf4a0a85566ca5";
const nodeLicense = path.join(
  root,
  "docs",
  "licenses",
  "NODE-v24.18.0-LICENSE.txt",
);
const threeLicense = path.join(root, "node_modules", "three", "LICENSE");
const checksum = async (file) =>
  createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");

async function main() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error(
      "Ce paquet utilise le runtime Windows x64 courant. Exécutez-le sous Windows x64.",
    );
  }
  if (process.version !== expectedNodeVersion) {
    throw new Error(
      `Runtime attendu : Node ${expectedNodeVersion}; runtime courant : ${process.version}. La licence doit correspondre au binaire.`,
    );
  }
  for (const required of [
    path.join(root, "dist", "index.html"),
    path.join(root, "scripts", "serve.mjs"),
    path.join(root, "scripts", "desktop-launch.mjs"),
    path.join(root, "README.md"),
    path.join(root, "docs", "GAMEPLAY.md"),
    path.join(root, "docs", "THIRD-PARTY.md"),
    path.join(root, "docs", "ASSET-SOURCES.md"),
    nodeLicense,
    threeLicense,
  ])
    await fs.access(required);
  if ((await checksum(nodeLicense)) !== nodeLicenseHash) {
    throw new Error(
      `La licence Node mise en cache ne correspond pas à la source vérifiée : ${nodeLicenseSource}`,
    );
  }

  // The only removable folder is the exact generated output inside this repository.
  // No shell expansion, environment-derived destination or arbitrary path is accepted.
  if (
    path.relative(root, releaseRoot) !== "release" ||
    path.relative(releaseRoot, destination) !== "Minecrack-Windows-v1.3"
  ) {
    throw new Error("Destination du paquet hors du dossier release attendu.");
  }
  await fs.mkdir(releaseRoot, { recursive: true });
  const releaseInfo = await fs.lstat(releaseRoot);
  if (releaseInfo.isSymbolicLink() || !releaseInfo.isDirectory())
    throw new Error("release doit être un dossier local ordinaire.");
  const existing = await fs.lstat(destination).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing?.isSymbolicLink())
    throw new Error("La destination ne peut pas être un lien symbolique.");
  if (existing) await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.join(destination, "runtime"), { recursive: true });
  await fs.mkdir(path.join(destination, "scripts"), { recursive: true });
  await fs.mkdir(path.join(destination, "licenses"), { recursive: true });
  await fs.cp(path.join(root, "dist"), path.join(destination, "dist"), {
    recursive: true,
  });
  await fs.cp(path.join(root, "docs"), path.join(destination, "docs"), {
    recursive: true,
  });
  await fs.copyFile(
    path.join(root, "scripts", "serve.mjs"),
    path.join(destination, "scripts", "serve.mjs"),
  );
  await fs.copyFile(
    path.join(root, "scripts", "desktop-launch.mjs"),
    path.join(destination, "scripts", "desktop-launch.mjs"),
  );
  await fs.copyFile(
    path.join(root, "README.md"),
    path.join(destination, "README.md"),
  );
  await fs.copyFile(
    process.execPath,
    path.join(destination, "runtime", "node.exe"),
  );
  await fs.copyFile(
    nodeLicense,
    path.join(destination, "licenses", "NODE-v24.18.0-LICENSE.txt"),
  );
  await fs.copyFile(
    threeLicense,
    path.join(destination, "licenses", "THREE-LICENSE.txt"),
  );

  const launcher = [
    "@echo off",
    "setlocal",
    'cd /d "%~dp0"',
    "title Minecrack",
    'set "PORT=5194"',
    'if not exist "runtime\\node.exe" goto missing',
    'if not exist "dist\\index.html" goto missing',
    '"runtime\\node.exe" "scripts\\serve.mjs" --open',
    "if errorlevel 1 goto failed",
    "exit /b 0",
    ":missing",
    "echo Le dossier est incomplet. Extrayez toute l archive avant de lancer le jeu.",
    "goto failed",
    ":failed",
    "echo Le lancement a echoue. Consultez le message ci-dessus.",
    "pause",
    "exit /b 1",
    "",
  ].join("\r\n");
  await fs.writeFile(
    path.join(destination, "Lancer-Minecrack.cmd"),
    launcher,
    "ascii",
  );
  await fs.writeFile(
    path.join(destination, "LISEZ-MOI.txt"),
    [
      "MINECRACK — VERSION PORTABLE WINDOWS X64",
      "",
      "1. Extrayez TOUT le dossier Minecrack-Windows-v1.3 de l’archive.",
      "2. Double-cliquez sur Lancer-Minecrack.cmd.",
      "3. Une fenêtre de jeu Chrome ou Edge ouvre http://127.0.0.1:5194.",
      "4. Cliquez sur Jouer ou Reprendre l’aventure pour capturer la souris.",
      "ZQSD : déplacement. Ctrl : courir. Maj : s’accroupir. E : inventaire. Échap : pause.",
      "Clic gauche : miner/frapper. Clic droit : utiliser/poser. Maintenez pour manger.",
      "",
      "Aucune installation Node.js, aucun compte et aucune connexion Internet ne sont nécessaires.",
      "Gardez la fenêtre du lanceur ouverte. Fermez-la pour arrêter le serveur local.",
      "Les sauvegardes restent dans ce navigateur, à cette adresse, sur cet appareil.",
      "La copie de ce dossier ne transfère pas les sauvegardes du navigateur.",
      "",
      "Commandes et détails : README.md et docs/GAMEPLAY.md.",
      "Licences et sources : docs/THIRD-PARTY.md, docs/ASSET-SOURCES.md et licenses/.",
      "",
    ].join("\r\n"),
    "utf8",
  );
  const threePackage = JSON.parse(
    await fs.readFile(
      path.join(root, "node_modules", "three", "package.json"),
      "utf8",
    ),
  );
  const manifest = {
    name: "Minecrack",
    version: "1.3.0",
    platform: process.platform,
    architecture: process.arch,
    createdAt: new Date().toISOString(),
    nodeVersion: process.version,
    threeVersion: threePackage.version,
    url: "http://127.0.0.1:5194",
    launcher: "Lancer-Minecrack.cmd",
    runtime: {
      file: "runtime/node.exe",
      bytes: (await fs.stat(process.execPath)).size,
      sha256: await checksum(process.execPath),
    },
    licenses: {
      nodeSource: nodeLicenseSource,
      nodeSHA256: nodeLicenseHash,
      three: "licenses/THREE-LICENSE.txt",
    },
  };
  await fs.writeFile(
    path.join(destination, "package-info.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(`Paquet prêt : ${destination}`);
  console.log(
    "Runtime inclus, aucun téléchargement nécessaire pour jouer. Archivez ce dossier complet.",
  );
}

main().catch((error) => {
  console.error(`Packaging interrompu : ${error.message}`);
  process.exitCode = 1;
});
