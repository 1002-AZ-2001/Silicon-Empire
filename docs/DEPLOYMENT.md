# Déploiement

La v0.1 est un site statique. `pnpm build` produit les fichiers dans `dist/`. Pour tester cette version sur la machine de développement, lancer `pnpm preview` et ouvrir l’adresse affichée. Les fichiers de `dist/` peuvent être servis par un hébergeur statique ou derrière un reverse proxy HTTPS. Les notices des dépendances distribuées accompagnent le site dans `LICENCES-TIERCE-PARTIE.txt`.

IndexedDB rattache les sauvegardes à l’origine du site et au profil du navigateur. Conserver le même schéma, le même hôte et le même port pour retrouver les ateliers. La v0.1 enregistre dans IndexedDB à la demande du joueur. L’export JSON est prévu pour transférer les sauvegardes entre origines ou profils.

Objectif v0.5 pour l’auto-hébergement sur TrueNAS SCALE ou VM Linux/Proxmox. Construire une image statique et lancer `docker compose up -d --build` sur un port hôte configurable. Plus tard, le backend ajoutera la persistance dans `/data`, les sauvegardes SQLite et une API de même origine.
