# Architecture technique

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
Configuration initiale ajustable : carte 64 × 64, tuiles 32 pixels, 20 ticks/s en x1, pause/x1/x2/x5, rendu cible 60 FPS. Horloge à pas fixe indépendante du framerate, limitation du rattrapage des ticks pour éviter un blocage. Temps en ticks, prix en centimes entiers, identifiants stables, positions entières, orientation sérialisée. Générateur pseudo-aléatoire seedé dont l’état est sauvegardé.

Systèmes : World, Construction, Inventory, Logistics, Production, Economy, Contract, Time ; Power, Maintenance et Research ensuite. Ordre stable documenté ; tests sans navigateur, actions validées au même endroit et résultats reproductibles à entrées égales. Éviter un ECS complexe sans besoin démontré.

Performance : mesurer avant d’optimiser. Culling caméra, atlas de textures, pooling de sprites, indexation spatiale, mises à jour différentielles, systèmes actifs seulement, publications UI regroupées, workers si utile. Objectif progressif : centaines de machines et milliers de convoyeurs/items, à valider par profilage.

## 17. Sauvegardes
IndexedDB : nouvelle partie, plusieurs slots, sauvegarde manuelle/automatique, export/import JSON, suppression confirmée. Enregistrer version du schéma, ID de partie, seed et état RNG, dates, ticks, capital, carte, machines, stocks, ressources en transit et en cours, produits et révisions, commandes, recherches débloquées. Conserver un état cohérent en milieu de cycle. Valider à l’import, migrer les anciennes versions explicitement et signaler les erreurs sans écraser la sauvegarde existante. Aucun progrès hors ligne dans le MVP.

Futur : persistance serveur et reprise multi-appareils via API. Les sauvegardes locales sont modifiables ; acceptable en solo, insuffisant pour la compétition. Le multijoueur compétitif exigerait un serveur faisant autorité.

## 18. Déploiement et sécurité
Cibles : Docker, Compose, Linux, TrueNAS SCALE ou VM Proxmox, reverse proxy HTTPS. MVP : image statique, port HTTP hôte configurable (8080 proposé), aucun compte ni backend obligatoire. Commande cible après implémentation : `docker compose up -d --build`. La commande ne fonctionne pas dans le dépôt documentaire initial ; Codex créera les fichiers.

Navigateur → reverse proxy Caddy → frontend. Domaine configurable, pas de domaine privé en dur. Plus tard : Node/Fastify, API REST, SQLite, comptes, administration, sauvegardes distantes, volume `/data`, endpoint de santé, même origine frontend/API si possible.

Sécurité serveur future : validation d’entrée, hachage des mots de passe, requêtes SQL paramétrées, limitation de débit, contrôle d’accès par utilisateur, cookies sécurisés, secrets hors Git via environnement, conteneurs non privilégiés, ports minimaux, exports et journalisation. Ne pas exposer les services administratifs inutilement. Pas de microtransactions ni dépendance à un service payant pour jouer.

## 19. Références techniques
- Phaser : https://docs.phaser.io/ ; modèle React/TS : https://github.com/phaserjs/template-react-ts
- React : https://react.dev/ ; TypeScript : https://www.typescriptlang.org/ ; Vite : https://vite.dev/
- IndexedDB : https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Docker : https://docs.docker.com/ ; GitHub CLI : https://cli.github.com/
- Codex : https://chatgpt.com/codex
Les références sont des points de départ ; les versions exactes seront vérifiées au démarrage du développement.
