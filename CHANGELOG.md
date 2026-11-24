# Changelog

## Non publié — v0.2, tranche 1 : logistique

- Horloge de simulation à pas fixe (20 ticks/s), pause, ×1, ×2, ×5, touche **P** et temps simulé affiché.
- Catalogue de sept composants de fabricants fictifs et commande d’un lot de 10 unités au quai de réception, débitée du capital.
- Inventaires du quai (100 unités) et du casier (40 unités), ports d’entrée et de sortie pivotés avec l’équipement et dessinés sur la grille.
- Convoyeur constructible (40 €) : transport orienté, 2 unités par tuile, saturation et blocage propagé en amont, unités animées par interpolation.
- Démolition : composants contenus mis au rebut, annoncés dans le dialogue et comptés dans le registre.
- Sauvegarde v2 avec unités en transit et migration des sauvegardes v0.1.0. Contrôle de cohérence, dont la conservation des composants. Atelier repris en pause.
- Tests du moteur (ports, achats, transport, saturation, rebut, déterminisme, horloge), du format v2 et un parcours Chromium complet avec rechargement.

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
