# Déploiement

`pnpm build` produit le site statique dans `dist/`. Pour le tester sur la machine de développement, lancer `pnpm preview` et ouvrir l’adresse affichée. Un hébergeur statique ou un reverse proxy HTTPS peut servir les fichiers de `dist/`. Les notices des dépendances distribuées accompagnent le site dans `LICENCES-TIERCE-PARTIE.txt`.

## Docker Compose

Avec Docker et le plugin Compose, lancer ces commandes à la racine du dépôt sur l’hôte Linux, par exemple une VM Proxmox.

```sh
docker compose up -d --build
docker compose ps
```

Compose publie le port 8080 de l’hôte par défaut. Ouvrir `http://localhost:8080` depuis l’hôte, ou utiliser son adresse depuis un autre poste. Pour choisir un autre port, définir `SILICON_EMPIRE_PORT` dans le fichier `.env` à la racine du dépôt ou dans le shell avant `docker compose up`. Pour un accès en HTTPS, faire pointer le reverse proxy vers le port hôte choisi.

L’image compile le jeu avec les dépendances verrouillées et le sert via Caddy, sous un utilisateur non privilégié. Compose vérifie que la page d’accueil répond. `docker compose down` arrête le service.

## Sauvegardes et changement d’adresse

IndexedDB rattache les ateliers à l’origine du site et au profil du navigateur. Pour changer de domaine, de port ou passer de HTTP à HTTPS, enregistrer l’atelier puis l’exporter en JSON depuis le menu principal. À la nouvelle adresse, **Importer une sauvegarde** crée une copie indépendante. La même procédure fonctionne entre le navigateur et le jeu installé. Le menu accepte les sauvegardes des formats v1 à v8 dans la limite de 10 Mio par fichier.

## Application de bureau

`pnpm desktop:dist` construit dans `release/` les paquets du système courant : NSIS sous Windows ; AppImage, `.deb` et pacman sous Linux (`bsdtar` requis). Le workflow de publication construit les deux familles sur des machines GitHub Windows et Ubuntu. Les mises à jour du jeu installé lisent les releases du dépôt : elles exigent un dépôt public. Les installeurs ne sont pas signés ; Windows SmartScreen affiche un avertissement au premier lancement.

## Publication des versions

Le workflow `.github/workflows/release.yml` s’exécute à chaque push sur `main`. Si la version de `package.json` n’a pas encore de tag `vX.Y.Z`, il installe les dépendances verrouillées, lance lint, typecheck, tests unitaires, build et tests Chromium, construit les paquets de bureau Windows et Linux, lance l’application Linux empaquetée, puis crée le tag sur le commit testé et publie la release : archive web, installeurs, métadonnées de mise à jour (`latest.yml`, `latest-linux.yml`) et fichier d’empreintes SHA-256. Les notes viennent de la section `## X.Y.Z` de `CHANGELOG.md` ; sans cette section, la publication échoue. Pour publier : augmenter la version dans une PR qui renomme la section du changelog, puis fusionner cette PR dans `main`.
