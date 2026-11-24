# Déploiement

La v0.1 est un site statique. `pnpm build` produit les fichiers dans `dist/`. Pour tester cette version sur la machine de développement, lancer `pnpm preview` et ouvrir l’adresse affichée. Les fichiers de `dist/` peuvent être servis par un hébergeur statique ou derrière un reverse proxy HTTPS. Les notices des dépendances distribuées accompagnent le site dans `LICENCES-TIERCE-PARTIE.txt`.

IndexedDB rattache les sauvegardes à l’origine du site et au profil du navigateur. Conserver le même schéma, le même hôte et le même port pour retrouver les ateliers. Les sauvegardes sont enregistrées dans IndexedDB à la demande du joueur. Le format v2 contient aussi l’horloge, les stocks et les unités sur les convoyeurs ; les ateliers enregistrés avec la v0.1.0 sont migrés à la lecture. L’export JSON est prévu pour transférer les sauvegardes entre origines ou profils.

Objectif v0.5 pour l’auto-hébergement sur TrueNAS SCALE ou VM Linux/Proxmox. Construire une image statique et lancer `docker compose up -d --build` sur un port hôte configurable. Plus tard, le backend ajoutera la persistance dans `/data`, les sauvegardes SQLite et une API de même origine.

## Publication des versions

Le workflow `.github/workflows/release.yml` s’exécute à chaque push sur `main`. Si la version de `package.json` n’a pas encore de tag `vX.Y.Z`, il installe les dépendances verrouillées, lance lint, typecheck, tests unitaires, build et tests Chromium, puis crée le tag sur le commit testé et publie la release avec l’archive de `dist/` et son empreinte SHA-256. Les notes viennent de la section `## X.Y.Z` de `CHANGELOG.md` ; sans cette section, la publication échoue. Pour publier : augmenter la version dans une PR qui renomme la section du changelog, puis fusionner cette PR dans `main`.
