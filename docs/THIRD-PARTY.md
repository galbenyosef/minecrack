# Composants tiers et licences

Minecrack utilise des composants logiciels libres pour son moteur et son lancement local. Les marques, logos, références culturelles et images de produits sont documentés séparément dans le [registre des sources visuelles](ASSET-SOURCES.md).

## Logiciels distribués

| Composant | Version préparée | Rôle | Licence fournie |
|---|---|---|---|
| Node.js, Windows x64 | 24.18.0 | Runtime du serveur HTTP local dans la distribution portable | `licenses/NODE-v24.18.0-LICENSE.txt` dans le paquet, texte intégral incluant ses composants tiers |
| Three.js | 0.180.0 | Rendu WebGL, géométries, matériaux et interactions 3D | `licenses/THREE-LICENSE.txt` dans le paquet, licence MIT |

La [licence officielle Node.js v24.18.0](https://raw.githubusercontent.com/nodejs/node/v24.18.0/LICENSE) a été récupérée depuis le dépôt du projet et conservée intégralement dans [la copie locale](licenses/NODE-v24.18.0-LICENSE.txt). Son empreinte SHA-256 est `148eacf7863ef4329224a29398623077200a27194aa075569faf4a0a85566ca5`. Le script de packaging vérifie cette empreinte et exige un runtime de la même version avant de le copier.

La [licence Three.js r180](https://github.com/mrdoob/three.js/blob/r180/LICENSE) correspond à la version installée. Le packaging copie directement `node_modules/three/LICENSE`, sans modifier son texte.

`package-info.json` indique la version et l’empreinte SHA-256 du binaire Node inclus, la version de Three.js et la date de préparation. Le serveur reste lié à `127.0.0.1`; aucun service distant ni installation de dépendance n’est nécessaire pour jouer avec le paquet extrait.

## Outils de développement

Vite prépare les fichiers de distribution ; le module de test de Node.js et Playwright servent à la validation. Ces outils de développement ne sont pas requis pour lancer le paquet portable. Le détail reproductible des versions se trouve dans `package-lock.json` du projet source ; leurs licences restent dans leurs distributions respectives.

Les illustrations d’inventaire et textures de matières sont générées par `scripts/generate-items.py`, qui utilise Pillow lors de leur préparation. Python et Pillow ne sont pas embarqués dans le jeu.

## Visuels, modèles et son

Les géométries low-poly, textures de terrain, textures de matière et sons synthétisés ont été créés pour cette version. Le [registre des 16 objets](ASSET-SOURCES.md) identifie les images consultées, les fichiers téléchargés et les logos ou couvertures effectivement intégrés. Les éléments provenant d’éditeurs, de marques ou de créateurs conservent leurs titulaires et leurs conditions propres ; ils ne sont pas couverts par les licences MIT des bibliothèques.

La musique originale de **Portal** n’est pas incluse. La radio joue une composition synthétisée originale par défaut, ou un fichier audio choisi localement par le joueur. Ce fichier n’est ni téléversé ni copié dans le paquet.

Minecrack est une création de jeu indépendante ; les références à Minecraft, Portal, McDonald’s, l’URSSAF, des organisations et des personnalités ne désignent pas une affiliation ou un partenariat.
