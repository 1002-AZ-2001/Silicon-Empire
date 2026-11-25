# Silicon Empire

*From components to an industrial empire.*

Jeu de gestion industrielle informatique en 2D, solo et jouable dans un navigateur. On construit un atelier de 64 × 64 tuiles avec un capital initial de 25 000 €, on commande des composants, on assemble, teste et emballe des PC sur des chaînes de convoyeurs, et on livre des pièces à la Direction pour débloquer de nouveaux équipements, palier après palier. Le mode bac à sable débloque tout dès le départ.

## Langues

Français, English, Español, Deutsch, 简体中文, 日本語. Le jeu suit la langue du système au premier lancement ; le sélecteur **Langue** du menu principal permet d’en changer.

## Installer le jeu

Windows, Debian/Ubuntu et Arch Linux : télécharger l’installeur sur la [page des versions](https://github.com/1002-AZ-2001/Silicon-Empire/releases/latest), puis suivre le **[tutoriel d’installation](docs/INSTALLATION.md)**. Le jeu se met à jour depuis son menu principal.

## Jouer en local

Depuis le code source, utiliser Node.js 24 et pnpm 11.25.0. La version Node utilisée pour la validation est indiquée dans `.node-version`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Ouvrir l’adresse affichée par Vite, puis choisir **Nouvelle partie**. Les ateliers enregistrés apparaissent dans le menu. IndexedDB conserve les sauvegardes dans le profil du navigateur et pour l’adresse exacte du jeu. Garder le même port et le même nom d’hôte pour retrouver ses ateliers.

| Action | Commande |
|---|---|
| Construire | Choisir un équipement dans la barre basse ou avec les touches 1 à 9 et 0 (dans l’ordre de la barre), puis cliquer sur la grille |
| Poser un convoyeur | **Convoyeur** ; **R** change son sens avant la pose |
| Tracer une ligne de convoyeurs | Avec l’outil **Convoyeur**, maintenir le clic gauche et glisser ; relâcher pour construire |
| Progresser | Construire la **Direction**, y acheminer par convoyeur les pièces du jalon choisi dans **Progression** |
| Produire | Alimenter l’établi, le banc de test ou l’emballeuse par leur entrée ; leur voyant indique l’état |
| Répartir ou fusionner | **Répartiteur** ou **Fusionneur** ; le filtre du répartiteur se règle dans l’inspection |
| Commander des composants | Inspecter un quai de réception, choisir un composant, puis **Commander 10 unités** |
| Régler le temps | **Pause**, **×1**, **×2**, **×5** dans la barre haute ; **P** met en pause ou reprend |
| Inspecter | **Inspecter** ou **I**, puis cliquer sur l’équipement |
| Pivoter de 90° | **R** ou **Pivoter**, sur l’aperçu ou sur l’équipement inspecté |
| Démolir | **Démolir** ou **X**, cliquer sur l’équipement, puis confirmer |
| Revenir à l’inspection | **Échap** |
| Déplacer la vue | **ZQSD**, **WASD**, flèches sur la grille, ou glisser avec le bouton droit ou central |
| Zoomer | Molette sur la grille ou boutons de caméra |

Les constructions sont facturées au placement. La démolition rembourse 50 % du prix payé ; les composants qu’elle contient sont mis au rebut. Sur la grille, une flèche orange marque une sortie, une flèche verte une entrée, et une croix rouge un convoyeur qui ne mène nulle part. Le quai sort par sa flèche ; le casier reçoit par l’arrière et ressort par sa flèche. Un atelier repris démarre en pause. Utiliser **Enregistrer** pour conserver les modifications ou **Enregistrer et quitter** pour revenir au menu avec l’état sauvegardé.

## Vérifier le projet

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm desktop:dist
xvfb-run -a pnpm test:desktop   # Linux, sur l’application empaquetée
```

Les tests Playwright construisent et servent la version de production sur le port local 4179. Avec un Chromium système compatible, on peut utiliser `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm test:e2e`.

## Documentation

- [Installer et lancer le jeu](docs/INSTALLATION.md)
- [Game Design Document](docs/GDD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap et validation](docs/ROADMAP.md)
- [Équilibrage](docs/GAME_BALANCE.md)
- [Déploiement](docs/DEPLOYMENT.md)
- [Instructions agents](AGENTS.md)
- [Mission Codex](CODEX_TASK.md)
- [Dossier PDF de conception initiale](docs/Silicon_Empire_Handoff.pdf)

Le nom est provisoire. Sa disponibilité commerciale n’a pas été vérifiée. Le code est distribué sous licence [GNU Affero General Public License v3](LICENSE). Les dépendances tierces gardent leurs propres licences (`apps/web/public/LICENCES-TIERCE-PARTIE.txt`).
