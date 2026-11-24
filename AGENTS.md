# Instructions aux agents de développement

Lire `docs/GDD.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/GAME_BALANCE.md` et `docs/DEPLOYMENT.md` avant de modifier le projet. La mission initiale est définie dans `CODEX_TASK.md`.

- Préserver les modifications utilisateur et les fonctionnalités existantes ; inspecter avant modification.
- Implémenter par jalons. Ne pas construire toute la vision finale à la fois.
- TypeScript strict, simulation indépendante de Phaser/React/DOM, commandes validées, état de monde unique.
- Données configurables, ressources conservées, comportements déterministes, sauvegardes versionnées.
- Pas de faux boutons, de fonctions factices ni de tests prétendument exécutés.
- Assets originaux ou licences vérifiées ; noms de fabricants fictifs.
- Vérifier les versions compatibles dans les docs officielles et épingler les dépendances.
- Exécuter lint, typecheck, tests et build ; rapporter les commandes et résultats réels, y compris les échecs.
- Mettre à jour les docs et CHANGELOG.md. Documenter les décisions, hypothèses et limites.
- Éviter les dépendances inutiles, les abstractions prématurées et les dossiers vides.
- Ne pas effectuer de push distant ni de déploiement externe sans autorisation. Ne pas toucher à l’infrastructure personnelle.
