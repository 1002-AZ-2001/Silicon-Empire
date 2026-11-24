# Roadmap et validation

## 20. Périmètre MVP
Départ proposé : 25 000 €, atelier vide, carte 64 × 64, catalogue limité, un fournisseur, commandes simples et trois catégories de PC (bureautique, gaming, professionnel). Priorité : boucle de production et vente réellement jouable.

Obligatoire : menu, nouvelle partie, caméra/zoom, grille, placement/rotation/démolition, convoyeurs, stocks, achats, Product Designer, assemblage, test, emballage, expédition, commandes, finances, pause/vitesses, sauvegarde/chargement et Docker.

Exclus : multijoueur, semi-conducteurs, histoire, employés autonomes, IA concurrente complexe, IT détaillée, réseau électrique complet, international, multisite, hors ligne et microtransactions. Ces fonctions restent dans la vision, pas dans les premières tâches.

## 21. Jalons
| Version | Livrable |
|---|---|
| Phase 0 | Dépôt, TypeScript/Phaser/React/Vite, lint, tests, types et documentation. |
| 0.1 | Menu, carte, caméra, zoom, placement, rotation, démolition, inspection et sauvegarde. |
| 0.2 | Catalogues, inventaires, convoyeurs, ports, répartiteurs, saturation et items animés. |
| 0.3 | Recettes, assembleurs, tests, emballage, quais et états machines. |
| 0.4 | Product Designer, fournisseurs, commandes, coûts, marges, tableau financier. |
| 0.5 | MVP : Docker, tutoriel, sauvegardes finalisées, tests et optimisation. |
| 0.6 | Électricité, recherche, maintenance, pannes, machines améliorées. |
| 0.7 | Employés, bureaux, prêts, marketing, réputation et événements. |
| 0.8 | Backend, comptes, sauvegardes distantes et administration. |
| 0.9 | Matières premières, PCB, RAM, stockage et composants. |
| 1.0 | CPU/GPU, recherche avancée, concurrence, IT et multisite. |
La roadmap est indicative et révisable selon les tests de gameplay.

## 22. Tests et critères d’acceptation
- Placement sur tuile libre ; refus collision, limites ou fonds insuffisants ; rotation correcte.
- Transfert valide entre ports/convoyeurs, saturation et conservation des ressources.
- Machine sans ingrédients bloquée ; sortie pleine bloquée ; consommation et résultat corrects.
- Configuration invalide refusée ; BOM et révisions préservées.
- Livraison et paiement corrects ; pas de paiement double.
- Sauvegarde/rechargement en milieu de cycle ; import invalide rejeté sans perte.
- Même état de simulation pour mêmes commandes, seed et nombre de ticks, indépendamment de la vitesse.
- Compilation, lint, tests unitaires et tests navigateur réels si disponibles.

Scénario MVP : nouvelle partie → achat → construction → configuration PC → assemblage → test → emballage → livraison → paiement → agrandissement → sauvegarde → fermeture navigateur → rechargement fidèle. Aucun recours à une modification manuelle du code ou des données.

## 23. Première mission Codex
Commencer exclusivement par phase 0 et v0.1. Inspecter les fichiers et modifications existants. Initialiser l’application TypeScript/Phaser/React/Vite et les outils de qualité. Mettre à jour les docs et définir le modèle de monde. Développer menu, nouvelle partie, carte interactive, zoom, caméra, barre de construction, aperçu de placement, machines orientables et supprimables, panneau d’inspection, sauvegardes IndexedDB, tests et build. Les machines peuvent être des entités constructibles sans production à ce stade, mais ne pas prétendre que leurs fonctions futures sont réalisées.

Vérifier les actions de construction, les coûts, les contrôles et la restauration réelle. Tester le navigateur si possible. Ne pas se limiter à un plan : implémenter dans le dépôt. Ne pas commencer les convoyeurs simulés, l’économie complète ou le backend avant validation de v0.1.

Livrer : résumé, fichiers modifiés, décisions, commandes de démarrage, résultats réels des tests, limites et prochaine étape recommandée. Aucun push ou déploiement externe sans autorisation.
