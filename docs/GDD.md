# Game Design Document

## 1. Vision et identité
Silicon Empire est un jeu de gestion industrielle 2D, solo, jouable dans un navigateur et entièrement auto-hébergeable. Le joueur part d’un atelier d’assemblage de PC et construit progressivement un empire informatique, jusqu’à concevoir ses propres composants et exploiter plusieurs usines. L’objectif est un véritable jeu spatial de construction et d’automatisation, et non un tableau de bord ou un idle game.

Inspirations : Satisfactory (automatisation), Factorio (flux physiques), SimCity (construction et économie), Software Inc. (entreprise et recherche), Production Line (assemblage), PC Building Simulator (configuration matérielle) et OpenTTD (logistique). Ne pas reproduire leurs assets ni leur identité graphique.

## 2. Progression industrielle
| Niveau | Développement |
|---|---|
| 1 — Atelier | Fournisseurs, montage, stockage, premières ventes et employés. |
| 2 — Usine | Convoyeurs, robots, tests, emballage et lignes parallèles. |
| 3 — Composants | Cartes mères, RAM, SSD, alimentations, boîtiers et PCB. |
| 4 — Semi-conducteurs | Architectures CPU/GPU, wafers, lithographie, salles blanches. |
| 5 — Multinationale | Plusieurs sites, R&D, datacenters, contrats publics, export et concurrence. |

## 2 bis. Progression jouable (v0.3)

Inspirée des jeux d’automatisation, sans en reprendre noms ni univers : la **Direction** de l’entreprise fixe des **jalons**. Le joueur y achemine par convoyeur des pièces achetées ou fabriquées ; chaque jalon terminé débloque des équipements ou des composants et verse une subvention. Les paliers 1 et 2 s’ouvrent après le palier 0. Des **contrats phares** — grandes commandes institutionnelles — ouvriront ensuite les paliers suivants deux par deux. Le mode bac à sable débloque tout.

## 3. Piliers et boucle de jeu
Construire librement, automatiser des flux physiques, gérer les finances, concevoir des produits et débloquer des technologies. Le joueur identifie les goulots d’étranglement, augmente les débits et arbitre entre coût, qualité, délais et investissement.

**Boucle :** acheter → réceptionner → stocker → concevoir un modèle → construire la chaîne → acheminer → assembler → tester → emballer → expédier → encaisser → réinvestir.

Construction sur grille : placement, orientation, déplacement et démolition, aperçu valide/invalide, murs, sols, portes, zones de stockage, quais, extensions, bureaux et infrastructures électriques (progressivement). Les machines ont des ports et des états lisibles dans le monde.

## 4. Catalogue de composants
| Catégorie | Exemples fictifs |
|---|---|
| CPU | 4, 8 ou 16 cœurs |
| GPU | Intégré, entrée de gamme, 8 ou 16 Go |
| RAM | 8, 16, 32, 64 Go |
| SSD | 256 Go, 1 To, 2 To |
| Carte mère | Sockets, chipsets, formats |
| Alimentation | 450, 650, 850 W |
| Boîtier | Mini, standard, grand format |
| Refroidissement | Ventirad, liquide |
| Emballage | Carton et protections |

Données extensibles : ID stable, nom, fabricant fictif, catégorie, prix, performance, consommation, compatibilité, fiabilité, génération, disponibilité, délai de livraison et sprite. Stocker dans des catalogues structurés, pas dans les composants UI.

## 5. Product Designer
Créer un modèle avec nom, catégorie, CPU, GPU, carte mère, RAM, stockage, alimentation, boîtier, refroidissement et prix. Calculer coût des pièces, coût de production, marge brute, consommation, performance, qualité, attractivité et nomenclature (BOM). Vérifier socket, génération RAM, formats, puissance, dimensions GPU, refroidissement et interfaces de stockage. Interdire la mise en production des modèles invalides. Conserver les révisions immuables pour les recettes et commandes existantes.

Catégories MVP : bureautique, gaming, professionnel. Plus tard : mini-PC, workstation, NAS, serveurs rackables, serveurs de calcul et stations IA.

Exemple : Silicon Gaming X1, CPU 8 cœurs, GPU 8 Go, RAM 16 Go, SSD 1 To, PSU 650 W, prix 899 €. Les valeurs économiques sont fictives et configurables ; le catalogue devra également fournir les autres composants compatibles.

## 6. Machines et production
| Équipement | Fonction |
|---|---|
| Quai de réception | Entrée des achats |
| Entrepôt | Stockage et sortie de ressources |
| Convoyeur | Transport à capacité limitée |
| Répartiteur / fusionneur | Séparer ou combiner des flux |
| Assembleur | Consommer la BOM, fabriquer un PC |
| Station de test | Vérifier qualité et orienter les défauts |
| Emballeuse | Conditionner les PC conformes |
| Quai d’expédition | Livrer les commandes |

Une machine a une recette, des inventaires d’entrée/sortie, capacité, vitesse, prix, consommation, usure et taux de défauts. États : arrêt, manque d’entrée, production, sortie saturée, manque d’énergie, maintenance, panne. Les états liés à l’énergie et à la maintenance sont activés lorsque ces systèmes existent.

Exemple de recette : un exemplaire de chaque pièce requise par la BOM → un PC assemblé, en 30 secondes simulées. Un GPU intégré ne nécessite pas une carte dédiée. Les temps et débits sont des paramètres d’équilibrage.

Les entrées sont consommées de façon atomique au démarrage et enregistrées comme travail en cours ; la sortie terminée attend si son tampon est plein. Respecter toutes les capacités, garantir la conservation des ressources et rendre les flux observables. Les déchets, rejets et démolitions doivent être comptabilisés explicitement. Aucun objet ne doit se dupliquer ou disparaître silencieusement.

Équipements futurs : robots et bras, SMT, fabrication PCB, soudure, wafers, lithographie, découpe, puces, recyclage et refroidissement industriel. Les processus de semi-conducteurs sont volontairement simplifiés pour le jeu.

## 7. Logistique interne
Convoyeurs droits et virages, sens de circulation, ports, répartiteurs/fusionneurs, filtrage, capacité et saturation. Afficher une prévisualisation du flux et refuser les connexions invalides. Les répartiteurs utilisent une politique stable (p. ex. alternance lorsque les sorties sont libres). Les blocages se propagent en amont. Des générations de convoyeurs plus rapides seront déblocables.

Le moteur décide des transferts ; les sprites ne sont qu’une représentation interpolée. Les transferts respectent un ordre déterministe et ne peuvent pas réutiliser deux fois la même ressource.

## 8. Économie, marché et contrats
Capital, revenus, achats, coûts unitaires, marges, investissements, coûts énergétiques, salaires, prêts et marketing. Le MVP comptabilise achats, construction et ventes ; les autres charges arrivent avec les systèmes correspondants. Les commandes sont liées à une révision de produit et enregistrent client, quantité, prix, échéance, qualité, récompenses et pénalités. Prévenir les doubles paiements. Exemple : 500 PC pour une université sous 30 jours de jeu.

Clients : particuliers, PME, grandes entreprises, écoles, universités, administrations, hébergeurs et datacenters. Plus tard : marché dynamique, réputation, concurrence, fournisseurs alternatifs, appels d’offres, publicité et retours SAV. Événements : pénuries, inflation, prix d’énergie, incident fournisseur, demande GPU, lancement concurrent, rappel, cyberattaque et réglementation. Les événements doivent laisser des choix, pas seulement pénaliser.

## 9. Énergie, maintenance et environnement (après MVP)
Raccordement, transformateurs, armoires, générateurs, solaire, batteries, onduleurs ; capacité et consommation, prix du kWh, surcharge, coupure et secours. Vue dédiée du réseau électrique. Maintenance préventive, pannes, pièces de rechange et usure. Pollution, eau, recyclage et traitement des déchets comme extensions.

## 10. Ressources humaines (après MVP)
Opérateurs, techniciens, ingénieurs, chercheurs, logisticiens, administrateurs systèmes et réseaux, commerciaux et responsables de production. Compétences, salaire, productivité, fatigue, satisfaction, formation et expérience. Bureaux, repos et formation. Commencer par des affectations simples, pas une IA de déplacement complexe.

## 11. Recherche et histoire (après MVP)
Branches : automatisation, logistique, CPU, GPU, RAM, stockage, réseau, énergie, robotique, IA, semi-conducteurs et recyclage. Les recherches nécessitent du temps, de l’argent et éventuellement des ressources.

Époques envisagées : années 1980 (PC pionniers), 1990 (démocratisation et 3D), 2000 (multimédia, multicœurs), 2010 (SSD, cloud et virtualisation), 2020 (NVMe, IA), futur (photonique, quantique, architectures expérimentales). Obsolescence et demande évolutive. Le MVP utilise une époque moderne fictive unique.

## 12. Infrastructure IT industrielle (après MVP)
Baies, serveurs, switches, routeurs, pare-feu, hyperviseurs, NAS, ERP, supervision, sauvegardes, cybersécurité et redondance. Des bénéfices concrets : fiabilité, stocks, commandes automatisées, visibilité, temps d’arrêt réduit et productivité. Ne pas simuler des protocoles réseau réels dans les premières versions.

## 13. Direction artistique et ergonomie
Vue de dessus orthographique, pixel art industriel moderne, machines lisibles, voyants, composants visibles, béton, racks, marquages de sécurité et animations de convoyeurs. Une vue isométrique pourra être étudiée plus tard. Tuiles de 32 × 32 pixels ; assets originaux, remplaçables, séparés de la logique. Éviter les marques et assets protégés ; noms de fabricants fictifs.

Écran : barre haute (capital, revenus, charges, temps, pause, vitesse, alertes) ; carte centrale interactive ; barre basse (construction, rotation, démolition) ; panneau contextuel (inventaires, recette, progression, état, rendement). Menus : dashboard, inventaire, Product Designer, production, fournisseurs, commandes, finances, recherche, employés, IT, statistiques, paramètres. N’afficher comme utilisables que les fonctionnalités réellement implémentées.

Contrôles : zoom molette, glisser caméra, WASD/ZQSD, R rotation, Échap annulation, démolition, infobulles, confirmation destructrice. Desktop prioritaire. Interface en français, anglais, espagnol, allemand, chinois simplifié et japonais (v0.2.3).
