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

La phase 0 et la v0.1 couvrent le socle de développement et la construction jouable.

La v0.2 est livrée en deux tranches :

- **Tranche 1 (réalisée)** : horloge à pas fixe avec pause, ×1, ×2 et ×5 ; catalogue de composants ; commande d’un lot au quai ; inventaires ; ports ; convoyeurs droits orientés, virages par enchaînement, saturation et remontée des blocages ; unités animées par interpolation ; mise au rebut comptabilisée ; sauvegarde v2 et migration v1.
- **Tranche 2 (réalisée en 0.2.1)** : répartiteurs et fusionneurs à alternance stable, filtre sur le répartiteur, tracé des convoyeurs au glisser, virages, signalement des convoyeurs sans destination.
- **Reste à faire** : insertion latérale au bon endroit de la bande (une unité qui entre par le côté d’un convoyeur droit apparaît encore à l’arrière de la bande) et transmission directe entre deux nœuds adjacents.

L’assembleur et le banc de test restent sans ports ni inventaire jusqu’à la v0.3.

**v0.3.0 (réalisée)** : production (assemblage, test, emballage), voyants d’état, Direction et progression par paliers 0 à 2, mode bac à sable. La progression reprend la mécanique des jeux d’automatisation (paliers, jalons payés en pièces, grands projets qui ouvrent les paliers suivants), avec des noms et un thème originaux.

**v0.3.1** livre le contrat phare de l’Université de Valmont. La Direction reçoit 50 PC bureautiques emballés et débloque la gamme gaming et son premier objectif au palier 3.

**v0.3.2** ouvre le palier 4 après le tournoi de Valmont. La gamme professionnelle ajoute le contrôle qualité et le tri des rebuts. L’Institut Sorel commande 10 PC professionnels conformes et emballés.

**v0.4.0** introduit le quai d’expédition, les commandes répétables et le tableau financier. Le règlement arrive à la dernière unité livrée.

**v0.4.1** ajoute la conception d’un modèle sur mesure, ses révisions et des fournisseurs aux prix et délais distincts.

**v0.5.0** ajoute le guide d’atelier, l’import et l’export JSON, et l’auto-hébergement via Docker Compose.

**v0.6.0** livre la recherche au laboratoire R&D et les machines Mk2. **v0.6.1** affiche les montants dans la monnaie de la langue ou celle choisie au menu.

**v0.7.0** ajoute la boutique : catalogue, panier multi-composants, remises de volume et commande atomique vers un quai.

**v0.8.0** ajoute le personnel : vivier de candidats, affectation aux machines, salaires mensuels, moral et opérateurs exigés en progression.

**v0.9.0** ajoute les murs, les portes, les sols, le mobilier et les pièces fonctionnelles détectées automatiquement (salle blanche, bureau, salle de repos).

**v0.9.1** agrandit le terrain à 128 × 128 tuiles et vend les parcelles voisines de l’atelier.

**v0.10.0** ajoute le mode Carrière (prêt, spécialité, composants, licences, vente au grossiste) et le tutoriel guidé.

**v0.11.0** ajoute l’électricité (câbles, réseau, groupe électrogène, factures), l’usure et les réparations, le niveau Mk3, la construction triée par onglets et la recherche dans la boutique.

**v0.12.0** ajoute les rôles des employés (opérateur, technicien, magasinier avec réassort, chercheur, développeur, concepteur, manager, commercial), les postes informatiques et le menu Entreprise.

Ordre retenu ensuite, une version par étape : timeline par époques (1975, 1985, 1995, 2005) avec le matériel de chaque époque, décor et paysage, carte du monde avec usines et transport, puces (semi-conducteurs) et chaîne complète jusqu’aux ordinateurs en carrière, une carte du monde pour ouvrir des usines dans d’autres pays, conception de composants maison (CPU, GPU, RAM, carte mère), concurrents simulés sur le marché. L’électricité, la maintenance et le confort de construction suivront.

La version 0.2.0 publie la tranche 1 avec l’application de bureau (Windows, Debian, Arch, AppImage) et ses mises à jour. La version 0.2.1 publie la tranche 2.

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
