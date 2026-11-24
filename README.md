# Silicon Empire

*From components to an industrial empire.*

Jeu de gestion industrielle informatique en 2D, solo et jouable dans un navigateur. On construit un atelier de 64 × 64 tuiles avec un capital initial de 25 000 €, on commande des composants au quai de réception et on les achemine par convoyeurs jusqu’aux casiers de stockage.

## Jouer en local

Utiliser Node.js 24 et pnpm 11.25.0. La version Node utilisée pour la validation est indiquée dans `.node-version`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Ouvrir l’adresse affichée par Vite, puis choisir **Nouvelle partie**. Les ateliers enregistrés apparaissent dans le menu. IndexedDB conserve les sauvegardes dans le profil du navigateur et pour l’adresse exacte du jeu. Garder le même port et le même nom d’hôte pour retrouver ses ateliers.

| Action | Commande |
|---|---|
| Construire | Choisir un équipement dans la barre basse ou avec les touches 1 à 5, puis cliquer sur la grille |
| Poser un convoyeur | **Convoyeur** ou **5** ; **R** change son sens avant la pose |
| Commander des composants | Inspecter un quai de réception, choisir un composant, puis **Commander 10 unités** |
| Régler le temps | **Pause**, **×1**, **×2**, **×5** dans la barre haute ; **P** met en pause ou reprend |
| Inspecter | **Inspecter** ou **I**, puis cliquer sur l’équipement |
| Pivoter de 90° | **R** ou **Pivoter**, sur l’aperçu ou sur l’équipement inspecté |
| Démolir | **Démolir** ou **X**, cliquer sur l’équipement, puis confirmer |
| Revenir à l’inspection | **Échap** |
| Déplacer la vue | **ZQSD**, **WASD**, flèches sur la grille, ou glisser avec le bouton droit ou central |
| Zoomer | Molette sur la grille ou boutons de caméra |

Les constructions sont facturées au placement. La démolition rembourse 50 % du prix payé ; les composants qu’elle contient sont mis au rebut. Sur la grille, une flèche orange marque une sortie et une flèche verte une entrée. Le quai sort par sa flèche ; le casier reçoit par l’arrière et ressort par sa flèche. Un atelier repris démarre en pause. Utiliser **Enregistrer** pour conserver les modifications ou **Enregistrer et quitter** pour revenir au menu avec l’état sauvegardé.

## Vérifier le projet

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Les tests Playwright construisent et servent la version de production sur le port local 4179. Avec un Chromium système compatible, on peut utiliser `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm test:e2e`.

## Documentation

- [Game Design Document](docs/GDD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap et validation](docs/ROADMAP.md)
- [Équilibrage](docs/GAME_BALANCE.md)
- [Déploiement](docs/DEPLOYMENT.md)
- [Instructions agents](AGENTS.md)
- [Mission Codex](CODEX_TASK.md)
- [Dossier PDF de conception initiale](docs/Silicon_Empire_Handoff.pdf)

Le nom est provisoire. Sa disponibilité commerciale n’a pas été vérifiée. Aucune licence définitive n’a été choisie.
