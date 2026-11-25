# Architecture technique

## Socle livré en v0.1

- `packages/game-data` définit la taille de l’atelier, le capital de départ et le catalogue validé avec Zod.
- `packages/simulation` contient le monde et les commandes de construction, rotation et démolition. Il fonctionne sans navigateur.
- `apps/web` héberge le menu et les outils React, la scène Phaser, le stockage IndexedDB et les sprites de construction. Zustand conserve l’outil, l’orientation de l’aperçu et la sélection. React et Phaser lisent le même instantané du monde.
- `tests/e2e` exécute les parcours Chromium sur le site compilé. Vitest vérifie les règles et le décodage des sauvegardes.

Une commande acceptée publie un nouvel instantané. Une commande refusée conserve le précédent. Le moteur traite les commandes dans l’ordre de réception, sans horloge ni tirage aléatoire pour ce jalon. Une machine possède un identifiant croissant, un type de catalogue, une case d’ancrage, une orientation et son prix payé en centimes. La rotation avance d’un quart de tour dans le sens horaire depuis le nord et conserve l’ancrage en haut à gauche de l’emprise. Les coordonnées internes commencent à zéro, les coordonnées affichées à un.

Le format IndexedDB v1 (v0.1.0) enregistrait un atelier par identifiant avec son nom, ses dates de création et d’enregistrement, ses dimensions, son capital, ses équipements et le prochain identifiant. Le chargement vérifie aussi les limites, les collisions et la cohérence du capital. Le menu signale les enregistrements incompatibles ou illisibles et conserve les autres ateliers. La caméra et l’outil reviennent à leurs valeurs initiales au chargement.

## Logistique livrée en v0.2 (tranche 1)

- `packages/game-data` ajoute le catalogue de composants (`items.ts`), la taille des lots d’achat, l’horloge (`TIME`), les paramètres de bande (`CONVEYOR`), la capacité d’inventaire et les ports de chaque équipement.
- `packages/simulation` sépare la disposition (`machines`, modifiée seulement par les commandes) de l’état dynamique : `stocks` (unités par machine), `belts` (unités sur chaque convoyeur, la plus avancée en premier), `ledger` (achats, rebuts, dépenses d’achat), `tick` et `nextItemId`. Les inventaires vides et les bandes vides sont absents, ce qui garde une représentation canonique.
- Les ports sont définis face au nord puis pivotés avec l’emprise. Un port de sortie pousse vers un convoyeur adjacent qui ne pointe pas vers la machine. Un convoyeur livre à une entrée si sa case suivante porte un port d’entrée tourné vers lui ; sinon il alimente le convoyeur suivant, sauf si celui-ci arrive de face. Les liaisons sont calculées une fois par disposition et mises en cache.
- Une bande mesure 20 unités de longueur. Une unité occupe les positions 0 à 19 et avance d’une unité par tick, à 10 unités au moins de la précédente. À la fin de la bande, elle passe au convoyeur suivant en conservant son excédent, entre dans un stock, ou attend. La saturation remonte ainsi jusqu’au quai.
- Ordre d’un tick : convoyeurs par identifiant croissant (transfert de l’unité de tête puis avance), puis sorties des machines par identifiant croissant. Une unité déplacée pendant le tick ne bouge plus avant le tick suivant. Une machine libère d’abord le premier composant du catalogue disponible.
- `FixedStepClock` convertit le temps réel en ticks entiers (20 par seconde × vitesse 0, 1, 2 ou 5) et limite le rattrapage à 10 ticks par image. `Simulation.advance` publie un seul événement `tick` par lot ; les commandes publient `command`. Le résultat ne dépend que des commandes et du nombre de ticks, pas du découpage des lots.
- Phaser redessine les équipements et les ports seulement quand la disposition change. Les unités sont interpolées entre l’état du tick précédent et l’état courant. React regroupe les rafraîchissements dus au temps (200 ms au plus) et applique immédiatement ceux des commandes.
- Le format de sauvegarde v2 ajoute l’horloge, les stocks, les bandes et le registre ; le format v3 (v0.2.1) ajoute les répartiteurs, fusionneurs et filtres. Les sauvegardes v1 et v2 sont migrées à la lecture sans réécriture de l’enregistrement d’origine. `checkIntegrity` vérifie les emprises, les capacités, l’espacement des bandes, l’unicité des unités, la conservation des composants (achetés = stockés + transportés + mis au rebut) et le capital engagé. Un atelier repris démarre en pause.

## Répartiteurs et fusionneurs (v0.2.1)

- `routers` conserve pour chaque répartiteur ou fusionneur l’unité tenue (identifiant conservé pour l’animation) et un curseur d’alternance. Le filtre d’un répartiteur est une propriété de la machine (`filter`), modifiée par la commande `configure`.
- Les liaisons décrivent, pour chaque nœud, ses entrées (convoyeurs qui pointent vers lui) et ses sorties (convoyeur ou entrée de stock). Un répartiteur accepte seulement l’arrière ; un fusionneur accepte tout sauf l’avant. Deux nœuds adjacents ne se transmettent pas d’unité.
- Les nœuds tirent : un convoyeur qui aboutit à un nœud garde son unité au bout de la bande ; pendant le tick, le nœud transmet d’abord l’unité qu’il tient, puis prend une unité en attente. Le curseur d’un répartiteur avance sur ses sorties, celui d’un fusionneur sur ses entrées, ce qui rend la répartition équitable et indépendante de l’ordre de construction.
- `build-line` construit une ligne de convoyeurs contiguë en une commande : tout est validé avant la construction, sinon rien n’est construit. Le sens de chaque tuile suit le tracé.
- Le rendu déduit la forme d’un convoyeur de ses alimentations : alimenté seulement par un côté, il est dessiné en virage et ses unités passent par ce côté. Un convoyeur sans destination porte une croix rouge.

## Application de bureau (v0.2)

- `apps/desktop/main.cts` crée la fenêtre Electron et sert `dist/` sous l’origine privilégiée `app://silicon-empire`. Une origine fixe garde les sauvegardes IndexedDB entre lancements et mises à jour ; `file://` ne le garantit pas. Le gestionnaire refuse les chemins hors de `dist/`.
- La page reste isolée : `contextIsolation`, `sandbox`, pas d’intégration Node. La navigation hors de l’origine est bloquée ; seuls les liens vers la page des releases s’ouvrent dans le navigateur du système. Une seule instance tourne à la fois pour éviter deux écritures concurrentes dans les sauvegardes.
- `apps/desktop/preload.cts` expose `window.siliconDesktop` (`DesktopBridge`, typé dans `bridge.d.ts`) : version, état de mise à jour, vérification, téléchargement, installation. Le menu React n’affiche les commandes de mise à jour que si ce pont existe.
- `electron-updater` lit les releases GitHub publiques (`app-update.yml` généré par electron-builder). Téléchargement et installation n’ont lieu que sur demande (`autoDownload` et `autoInstallOnAppQuit` désactivés). Les messages d’erreur sont résumés avant affichage.
- `electron-builder.yml` produit l’installeur NSIS, l’AppImage, le `.deb` et le paquet pacman. Les dépendances système Debian et Arch sont listées explicitement : celles proposées par défaut pour pacman désignent des paquets retirés ou renommés d’Arch.
- Seul `electron-updater` est une dépendance d’exécution ; le reste du jeu est empaqueté par Vite. `tests/desktop` lance l’application Linux empaquetée avec Playwright, vérifie l’origine, l’isolement et la persistance d’une sauvegarde entre deux lancements.

Versions épinglées : Electron 45.2.3, electron-builder 26.18.0, electron-updater 6.8.11. [Mises à jour automatiques electron-builder](https://www.electron.build/docs/features/auto-update)

La v0.1 utilise Node.js 24, pnpm 11.25.0, Phaser 3.90, React 19.3, Vite 7.3 et TypeScript 5.9. Le manifeste épingle les versions exactes. [Prérequis de Vite](https://github.com/vitejs/vite/blob/v7.3.8/docs/guide/index.md) · [Caméra Phaser 3.90](https://github.com/phaserjs/phaser/blob/v3.90.0/src/cameras/2d/Camera.js) · [Versions des navigateurs Playwright](https://playwright.dev/docs/browsers)

## 14. Stack et principes
| Technologie | Rôle |
|---|---|
| TypeScript | Simulation et logique métier |
| Phaser | Rendu 2D, caméra, entrées |
| React + Vite | Interfaces et compilation |
| Zustand | État UI, pas la vérité du monde |
| Zod | Validation des catalogues et sauvegardes |
| IndexedDB | Persistance locale |
| Vitest + Playwright | Tests unitaires et navigateur |
| Web Workers | Optimisation éventuelle |
| Node.js + Fastify + SQLite | Backend futur |
| Docker + Compose, Caddy | Hébergement et HTTPS |

Choisir des versions stables compatibles après lecture des documentations officielles ; verrouiller les dépendances. Pas de service cloud obligatoire. Pas de serveur applicatif imposé au MVP. Le frontend est servi statiquement.

Flux : interaction → commande validée → simulation → événements/snapshots → rendu Phaser et UI React. Le moteur est indépendant du DOM, du rendu et du stockage. Une seule source de vérité ; React ne doit pas actualiser toutes ses vues à chaque frame. Les données (catalogues, recettes, paramètres) sont découplées du code d’interface. Prévoir une abstraction de persistance et un passage possible vers un Web Worker sans l’imposer prématurément.

## 15. Structure indicative du dépôt
```
silicon-empire/
  apps/web/src/
    game/{scenes,renderer,camera,input}/
    ui/{components,panels,menus,hooks}/
    stores/  persistence/
  apps/web/public/assets/
    machines/  items/  tiles/  icons/  audio/
  packages/simulation/src/
    world/  entities/  systems/  logistics/
    production/  economy/  time/
  packages/simulation/tests/
  packages/game-data/{items,machines,recipes,technologies}/
  packages/shared/src/
  tests/e2e/
  docs/
  AGENTS.md  README.md  CHANGELOG.md
  Dockerfile  compose.yml  .env.example
  package.json
```
Le backend `apps/api` sera ajouté lorsque nécessaire. Ne pas créer artificiellement des dossiers vides ; la structure s’adapte à la taille du code. Le dépôt livré à ce stade contient uniquement les spécifications et instructions, pas encore les applications.

## 16. Moteur de simulation
Configuration cible pour la simulation de production : carte 64 × 64, tuiles 32 pixels, 20 ticks/s en x1, pause/x1/x2/x5, rendu cible 60 FPS. Horloge à pas fixe indépendante du framerate, limitation du rattrapage des ticks pour éviter un blocage. Temps en ticks, prix en centimes entiers, identifiants stables, positions entières, orientation sérialisée. Générateur pseudo-aléatoire seedé dont l’état est sauvegardé.

Systèmes : World, Construction, Inventory, Logistics, Production, Economy, Contract, Time ; Power, Maintenance et Research ensuite. Ordre stable documenté ; tests sans navigateur, actions validées au même endroit et résultats reproductibles à entrées égales. Éviter un ECS complexe sans besoin démontré.

Performance : mesurer avant d’optimiser. Culling caméra, atlas de textures, pooling de sprites, indexation spatiale, mises à jour différentielles, systèmes actifs seulement, publications UI regroupées, workers si utile. Objectif progressif : centaines de machines et milliers de convoyeurs/items, à valider par profilage.

## 17. Sauvegardes
Cible MVP pour IndexedDB : nouvelle partie, plusieurs slots, sauvegarde manuelle/automatique, export/import JSON, suppression confirmée. La v0.1 fournit la sauvegarde manuelle, la reprise et la suppression confirmée par atelier. Enregistrer version du schéma, ID de partie, seed et état RNG, dates, ticks, capital, carte, machines, stocks, ressources en transit et en cours, produits et révisions, commandes, recherches débloquées. Conserver un état cohérent en milieu de cycle. Valider à l’import, migrer les anciennes versions explicitement et signaler les erreurs sans écraser la sauvegarde existante. Aucun progrès hors ligne dans le MVP.

Futur : persistance serveur et reprise multi-appareils via API. Les sauvegardes locales sont modifiables ; acceptable en solo, insuffisant pour la compétition. Le multijoueur compétitif exigerait un serveur faisant autorité.

## 18. Déploiement et sécurité
Cibles : Docker, Compose, Linux, TrueNAS SCALE ou VM Proxmox, reverse proxy HTTPS. MVP : image statique, port HTTP hôte configurable (8080 proposé), aucun compte ni backend obligatoire. Commande cible après implémentation : `docker compose up -d --build`. Le conteneur Docker et la composition sont prévus au jalon v0.5.

Navigateur → reverse proxy Caddy → frontend. Domaine configurable, pas de domaine privé en dur. Plus tard : Node/Fastify, API REST, SQLite, comptes, administration, sauvegardes distantes, volume `/data`, endpoint de santé, même origine frontend/API si possible.

Sécurité serveur future : validation d’entrée, hachage des mots de passe, requêtes SQL paramétrées, limitation de débit, contrôle d’accès par utilisateur, cookies sécurisés, secrets hors Git via environnement, conteneurs non privilégiés, ports minimaux, exports et journalisation. Ne pas exposer les services administratifs inutilement. Pas de microtransactions ni dépendance à un service payant pour jouer.

## 19. Références techniques
- Phaser : https://docs.phaser.io/ ; modèle React/TS : https://github.com/phaserjs/template-react-ts
- React : https://react.dev/ ; TypeScript : https://www.typescriptlang.org/ ; Vite : https://vite.dev/
- IndexedDB : https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Docker : https://docs.docker.com/ ; GitHub CLI : https://cli.github.com/
- Codex : https://chatgpt.com/codex
Les références sont des points de départ ; les versions exactes seront vérifiées au démarrage du développement.
