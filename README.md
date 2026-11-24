# Silicon Empire

*From components to an industrial empire.*

Jeu de gestion et d’automatisation industrielle informatique en 2D, natif web, solo et auto-hébergeable. Construire un atelier, assembler des PC, optimiser les chaînes de production et devenir un fabricant de composants.

**État : dépôt de spécifications, phase 0 à démarrer. Aucun jeu ni build applicatif n’est encore livré.**

## Documentation
- [Game Design Document](docs/GDD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap et validation](docs/ROADMAP.md)
- [Équilibrage](docs/GAME_BALANCE.md)
- [Déploiement](docs/DEPLOYMENT.md)
- [Instructions agents](AGENTS.md)
- [Mission Codex](CODEX_TASK.md)
- [Dossier PDF](docs/Silicon_Empire_Handoff.pdf)

## Démarrer avec Codex
Ouvrir ce dossier comme projet dans Codex, ou publier le dépôt sur GitHub et sélectionner le dépôt dans Codex web. Envoyer : « Lis AGENTS.md et CODEX_TASK.md, puis implémente la mission initiale. »

Publication GitHub privée (si GitHub CLI est installé et authentifié) :

```bash
gh auth login
gh repo create silicon-empire --private --source=. --remote=origin --push
```

Le nom est provisoire ; sa disponibilité commerciale n’a pas été vérifiée. Aucune licence définitive n’a été choisie.
