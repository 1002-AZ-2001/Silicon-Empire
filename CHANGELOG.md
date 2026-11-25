# Changelog

## 0.2.1 — Répartiteurs, fusionneurs et tracé des convoyeurs

- Répartiteur (150 €) : reçoit par l’arrière et distribue à tour de rôle à gauche, devant et à droite, en sautant les sorties non raccordées ou pleines.
- Filtre du répartiteur : un composant choisi part toujours sur une sortie choisie et attend si elle est bloquée ; les autres composants alternent sur les sorties restantes.
- Fusionneur (150 €) : prend à tour de rôle les unités qui attendent à gauche, à l’arrière et à droite, et les envoie devant.
- Tracé des convoyeurs au glisser : le sens suit le tracé, les virages se font seuls, longueur et coût affichés avant de relâcher. La ligne est construite en une fois ou refusée entière.
- Virages dessinés en coude ; croix rouge au bout d’un convoyeur qui ne mène nulle part ou fait face à un autre, sur la grille et pendant la pose.
- Sauvegarde v3 avec état des répartiteurs et fusionneurs ; migration des sauvegardes v0.1.0 et v0.2.0.
- Tests du moteur (alternance, filtre, équité du fusionneur, lignes, rebut) et parcours Chromium de tri complet.

## 0.2.0 — Logistique et application de bureau

- Horloge de simulation à pas fixe (20 ticks/s), pause, ×1, ×2, ×5, touche **P** et temps simulé affiché.
- Catalogue de sept composants de fabricants fictifs et commande d’un lot de 10 unités au quai de réception, débitée du capital.
- Inventaires du quai (100 unités) et du casier (40 unités), ports d’entrée et de sortie pivotés avec l’équipement et dessinés sur la grille.
- Convoyeur constructible (40 €) : transport orienté, 2 unités par tuile, saturation et blocage propagé en amont, unités animées par interpolation.
- Démolition : composants contenus mis au rebut, annoncés dans le dialogue et comptés dans le registre.
- Sauvegarde v2 avec unités en transit et migration des sauvegardes v0.1.0. Contrôle de cohérence, dont la conservation des composants. Atelier repris en pause.
- Tests du moteur (ports, achats, transport, saturation, rebut, déterminisme, horloge), du format v2 et un parcours Chromium complet avec rechargement.
- Application de bureau Electron : installeur Windows (NSIS), paquets Debian (.deb) et Arch (pacman), AppImage. Le jeu est servi depuis une origine fixe pour conserver les sauvegardes entre lancements et mises à jour.
- Mises à jour dans le menu principal : vérification au lancement, téléchargement puis installation au redémarrage, sur demande du joueur.
- Numéro de version affiché dans le menu, tiré de `package.json`.
- Workflow de publication : à chaque version non taguée sur `main`, tests, construction des paquets Windows et Linux, test de lancement de l’application Linux, puis release avec empreintes SHA-256.
- Tutoriel d’installation et de mise à jour (`docs/INSTALLATION.md`).
- Licence du projet : GNU AGPL v3 (`LICENSE`).

## 0.1.0 — Construction de l’atelier

- Socle TypeScript strict, React, Phaser et Vite avec dépendances verrouillées, ESLint, Vitest et Playwright.
- Menu français, grille de 64 × 64 tuiles, déplacements de caméra et zoom centré sur le pointeur.
- Quatre équipements aux sprites originaux, aperçu d’emprise, placement validé, rotation et inspection.
- Capital initial de 25 000 €, débit exact à la construction et remboursement de 50 % après confirmation de la démolition.
- Sauvegardes manuelles versionnées dans IndexedDB, reprise et suppression par atelier.
- Tests du moteur et du format de sauvegarde, scénarios Chromium sur le site compilé.

## Handoff initial

- Vision, design, architecture, roadmap, équilibrage et déploiement documentés.
- Instructions de développement et mission v0.1 préparées pour Codex.
