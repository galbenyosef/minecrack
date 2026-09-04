# Minecrack 1.1 — validation du 4 septembre 2026

## Résultat

47 tests Node et 8 parcours navigateur réussis. Les parcours finaux ont été exécutés sur le build Vite compilé, servi localement sur le port 5196 avec Node.js 24.18.0 et Chrome Windows. Le paquet portable contient ce même build et ce même runtime.

## Ce qui a été vérifié

- Clic maintenu : plusieurs mouvements complets de pioche, impacts synchronisés, au moins six stades de fissures observés pendant une destruction réelle, débris visibles.
- Relâchement, changement de cible et pause : aucune fissure persistante. Le geste se termine puis retourne au repos.
- Consommation du dernier objet : le modèle reste visible pendant le geste puis laisse une main vide.
- Ouverture/fermeture rapide de l’inventaire : la libération asynchrone de la souris ne remet plus le jeu en pause.
- Panneau de bureau 397 × 718 : outil cadré et neuf cases entièrement visibles.
- Déplacements ZQSD, saut, minage, placement, artisanat, sauvegarde et rechargement.
- Les seize résultats Lucky, vol de ressources au contact du bras, dégâts, recul progressif, peur, partage, costume, radio, bombardier et objets persistants.
- Géométrie hexagonale, normals plates, UV de chaque face, 512 × 512 et filtrage nearest, 25 Lucky Blocks au-dessus de 2 585 surfaces terrestres.
- Animation des personnages, marche/course sans rupture de phase, mort, flash isolé par clone et flottement sans dérive à 30/120 Hz.
- Nettoyage des fissures et particules, collisions des débris, disparition de la végétation lorsque son support est retiré.
- Chargement du jeu et des textures sans requêtes externes ; aucune erreur JavaScript dans les parcours contrôlés.

Une capture du canvas avec ses sons synthétisés a été enregistrée puis décodée. Le script `scripts/capture-gameplay.mjs` recrée cette démonstration dans une session isolée et ajoute une colonne de minerai pour filmer les fissures de face. Il ne touche pas à une sauvegarde existante.

## Reproduire

```powershell
npm test
npm run build
# Terminal séparé :
$env:PORT='5196'; npm start
# Terminal de test :
$env:MINECRACK_TEST_URL='http://127.0.0.1:5196'
npm run test:browser
node scripts/capture-gameplay.mjs '<dossier de sortie>'
```

Les vérifications couvrent cette machine Windows et Chrome. Elles ne constituent pas une certification de tous les pilotes graphiques ou navigateurs. Le jeu reste solo et le monde fini ; le cadrage étroit est adapté au clavier/souris, sans commandes tactiles.
