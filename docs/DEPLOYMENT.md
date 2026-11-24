# Déploiement

Le dépôt initial est documentaire ; le jeu et le Dockerfile ne sont pas encore implémentés. Objectif v0.5 : démarrage par `docker compose up -d --build`, puis accès via `http://localhost:8080` (port configurable). Le frontend doit fonctionner sans service externe. Les sauvegardes locales résident dans le navigateur, pas dans le conteneur : utiliser l’export JSON pour les transférer ou les sauvegarder. Plus tard, persistance serveur dans `/data`, sauvegarde SQLite cohérente, reverse proxy HTTPS et API de même origine.

Compatible en cible avec TrueNAS SCALE et hôtes Linux/Proxmox. Ne pas coder en dur un domaine, une adresse IP, des identifiants ni des secrets.
