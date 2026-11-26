# Changelog

## 0.3.2 — Postes professionnels et contrôle qualité

- Le tournoi de Valmont ouvre le palier 4, la gamme professionnelle, le kit mémoire de 32 Go et le SSD de 2 To.
- Le contrôle professionnel écarte un PC sur huit. Les PC conformes sortent par la flèche orange, les rebuts par la flèche rouge. Chaque sortie possède son propre tampon.
- L’Institut Sorel verse 20 000 € contre 10 PC professionnels conformes et emballés.
- La sauvegarde v6 lit les ateliers des versions précédentes et conserve les contrôles en cours, les rebuts et les modèles choisis.

## 0.3.1 — Contrat de Valmont et gamme gaming

- Le contrat de l’Université de Valmont demande 50 PC bureautiques emballés après les deux jalons initiaux du palier 2. La livraison complète verse 38 000 € et ouvre le palier 3.
- Les trois machines de production peuvent fabriquer la gamme gaming. L’assemblage ajoute une carte graphique par PC. Le tournoi de Valmont récompense la livraison de 20 PC gaming emballés.
- L’emballeuse possède deux entrées pour recevoir les PC testés et les cartons par des convoyeurs distincts.
- Le changement de modèle conserve les stocks compatibles et attend la fin du lot en cours et l’évacuation des produits finis.
- La sauvegarde v5 mémorise le modèle de chaque machine. Les anciens ateliers reprennent leur production bureautique en cours.

## 0.3.0 — Production et progression par paliers

- Progression inspirée des jeux d’automatisation : une **Direction** reçoit par convoyeur les pièces demandées par des **jalons**. Chaque jalon terminé débloque des équipements ou des composants et verse une récompense en capital, toujours supérieure au prix des pièces demandées.
- Palier 0 (Poste de montage, Contrôle qualité, Flux maîtrisés) à terminer dans l’ordre ; il ouvre les paliers 1 (Conditionnement, Entrepôt) et 2 (Convoyeurs rapides, Subvention régionale), dont les jalons se font dans n’importe quel ordre. Les livraisons d’un jalon sont gardées quand l’objectif change.
- Production réelle : l’établi assemble un PC bureautique en 30 s à partir de six composants ; le banc de test le contrôle en 10 s ; la nouvelle emballeuse le conditionne en 8 s avec un carton. Entrées consommées d’un coup au démarrage, produit fini retenu si la sortie est pleine, voyants d’état sur la grille.
- Nouveaux équipements : emballeuse, entrepôt (200 unités), convoyeur rapide (2 tuiles par seconde), Direction. Nouveaux articles : carton d’emballage et PC bureautique assemblé, testé puis emballé.
- Nouvelle partie en progression par défaut, ou en **bac à sable** (tout débloqué). Les ateliers des versions précédentes s’ouvrent en bac à sable.
- Une machine libère d’abord l’article dont elle a le plus en stock : un quai qui contient plusieurs composants les envoie en alternance, ce qui évite de bloquer un assembleur.
- Sauvegarde v4 (production, progression, registre étendu) et migration des versions 1 à 3. Conservation vérifiée : achetés + produits = détenus + rebut + consommés + livrés.
- Interface et nouveaux textes dans les six langues ; panneau de progression, détail de production et objectif de la Direction dans l’inspecteur.

## 0.2.3 — Langues

- Interface disponible en français, anglais, espagnol, allemand, chinois simplifié et japonais : menus, atelier, équipements, composants, messages d’erreur et mises à jour.
- Au premier lancement, le jeu suit la langue du système ou du navigateur, sinon l’anglais. Le sélecteur du menu principal change la langue ; le choix est mémorisé sur l’appareil.
- Montants et dates au format de la langue choisie ; les prix restent en euros.
- Dictionnaires typés sans dépendance : une traduction manquante fait échouer la vérification des types. Les noms affichés ne sont plus stockés dans les données de jeu.
- L’application de bureau transmet des codes d’état de mise à jour, traduits par l’interface.

## 0.2.2 — Mises à jour Linux sans agent polkit

- Paquets `.deb` et `.pacman` : le jeu installe lui-même la mise à jour par `pkexec`, sans shell et sans bloquer l’interface. Il ne lance plus `pacman -Sy`, une synchronisation partielle déconseillée sous Arch.
- Si les droits administrateur ne peuvent pas être obtenus (par exemple sans agent d’authentification polkit, `pkexec` quitte avec le code 127), le jeu explique la cause et propose la commande exacte à copier dans un terminal, ainsi que l’ouverture du dossier de la mise à jour.
- Après une installation réussie, le jeu redémarre sur la nouvelle version.
- Tutoriel : agents polkit par distribution et procédure pour les versions 0.2.0 et 0.2.1 déjà installées.

## 0.2.1 — Répartiteurs, fusionneurs et tracé des convoyeurs

- Répartiteur (150 €) : reçoit par l’arrière et distribue à tour de rôle à gauche, devant et à droite, en sautant les sorties non raccordées ou pleines.
- Filtre du répartiteur : un composant choisi part toujours sur une sortie choisie et attend si elle est bloquée ; les autres composants alternent sur les sorties restantes.
- Fusionneur (150 €) : prend à tour de rôle les unités qui attendent à gauche, à l’arrière et à droite, et les envoie devant.
- Tracé des convoyeurs au glisser : le sens suit le tracé, les virages se font seuls, longueur et coût affichés avant de relâcher. La ligne est construite en une fois ou refusée entière.
- Virages dessinés en coude ; croix rouge au bout d’un convoyeur qui ne mène nulle part ou fait face à un autre, sur la grille et pendant la pose.
- Sauvegarde v3 avec état des répartiteurs et fusionneurs ; migration des sauvegardes v0.1.0 et v0.2.0.
- Tests du moteur (alternance, filtre, équité du fusionneur, lignes, rebut) et parcours Chromium de tri complet.

## 0.2.0 — Logistique et application de bureau

- Horloge de simulation à pas fixe (20 ticks/s), pause, ×1, ×2, ×5, touche **P** et temps simulé affiché.
- Catalogue de sept composants de fabricants fictifs et commande d’un lot de 10 unités au quai de réception, débitée du capital.
- Inventaires du quai (100 unités) et du casier (40 unités), ports d’entrée et de sortie pivotés avec l’équipement et dessinés sur la grille.
- Convoyeur constructible (40 €) : transport orienté, 2 unités par tuile, saturation et blocage propagé en amont, unités animées par interpolation.
- Démolition : composants contenus mis au rebut, annoncés dans le dialogue et comptés dans le registre.
- Sauvegarde v2 avec unités en transit et migration des sauvegardes v0.1.0. Contrôle de cohérence, dont la conservation des composants. Atelier repris en pause.
- Tests du moteur (ports, achats, transport, saturation, rebut, déterminisme, horloge), du format v2 et un parcours Chromium complet avec rechargement.
- Application de bureau Electron : installeur Windows (NSIS), paquets Debian (.deb) et Arch (pacman), AppImage. Le jeu est servi depuis une origine fixe pour conserver les sauvegardes entre lancements et mises à jour.
- Mises à jour dans le menu principal : vérification au lancement, téléchargement puis installation au redémarrage, sur demande du joueur.
- Numéro de version affiché dans le menu, tiré de `package.json`.
- Workflow de publication : à chaque version non taguée sur `main`, tests, construction des paquets Windows et Linux, test de lancement de l’application Linux, puis release avec empreintes SHA-256.
- Tutoriel d’installation et de mise à jour (`docs/INSTALLATION.md`).
- Licence du projet : GNU AGPL v3 (`LICENSE`).

## 0.1.0 — Construction de l’atelier

- Socle TypeScript strict, React, Phaser et Vite avec dépendances verrouillées, ESLint, Vitest et Playwright.
- Menu français, grille de 64 × 64 tuiles, déplacements de caméra et zoom centré sur le pointeur.
- Quatre équipements aux sprites originaux, aperçu d’emprise, placement validé, rotation et inspection.
- Capital initial de 25 000 €, débit exact à la construction et remboursement de 50 % après confirmation de la démolition.
- Sauvegardes manuelles versionnées dans IndexedDB, reprise et suppression par atelier.
- Tests du moteur et du format de sauvegarde, scénarios Chromium sur le site compilé.

## Handoff initial

- Vision, design, architecture, roadmap, équilibrage et déploiement documentés.
- Instructions de développement et mission v0.1 préparées pour Codex.
