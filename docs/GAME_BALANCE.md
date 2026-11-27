# Équilibrage initial

| Paramètre | Proposition |
|---|---|
| Capital initial | 25 000 € |
| Carte | 64 × 64 tuiles |
| Tuile | 32 × 32 px |
| Simulation | 20 ticks/s |
| Vitesses | pause, x1, x2, x5 |
| Assemblage initial | 30 s simulées par PC |
| Prix exemple Gaming X1 | 899 € |

## Électricité, usure et niveaux v0.11.0

| Machine | Consommation Mk1 | Mk2 (×1,5) | Mk3 (×2) | Amélioration Mk2 | Amélioration Mk3 |
|---|---:|---:|---:|---:|---:|
| Établi d’assemblage | 10 kW | 15 kW | 20 kW | 3 000 € | 6 000 € |
| Banc de test | 8 kW | 12 kW | 16 kW | 3 500 € | 7 000 € |
| Emballeuse | 6 kW | 9 kW | 12 kW | 4 000 € | 8 000 € |
| Presse à condensateurs | 12 kW | 18 kW | 24 kW | 4 000 € | 8 000 € |
| Graveuse de circuits | 15 kW | 23 kW | 30 kW | 5 000 € | 10 000 € |
| Bobineuse | 15 kW | 23 kW | 30 kW | 5 500 € | 11 000 € |
| Ligne CMS | 30 kW | 45 kW | 60 kW | 12 000 € | 24 000 € |
| Laboratoire | 20 kW | — | — | — | — |

| Source | Prix | Puissance | Coût mensuel |
|---|---:|---:|---|
| Raccordement au réseau | 5 000 € | 150 kW | 12 € par kW consommé |
| Groupe électrogène | 8 000 € | 60 kW | 400 € |
| Câble | 5 € / tuile | — | — |

Quand un réseau mélange les deux sources, les groupes fournissent d’abord et le réseau facture le reste. Exemple : une presse et une graveuse en Mk1 (27 kW) sur le réseau coûtent 324 € par mois, contre 3 750 € de marge mensuelle ; un groupe électrogène devient rentable au-delà de 34 kW consommés en continu. L’usure arrête une machine Mk1 après 100 lots : 20 minutes simulées pour la presse, 50 minutes pour un établi d’assemblage.

## Carrière v0.10.0

| Prêt | Montant | Intérêts totaux | Mensualités | Mensualité |
|---|---:|---:|---:|---:|
| Démarrage | 20 000 € | 4 % | 24 | 866,67 € |
| Croissance | 50 000 € | 6 % | 24 | 2 208,34 € |
| Expansion | 100 000 € | 9 % | 36 | 3 027,78 € |

| Machine | Prix | Recette | Durée | Coût matières | Prix grossiste | Marge par mois |
|---|---:|---|---:|---:|---:|---:|
| Presse à condensateurs | 6 000 € | 2 céramique (25 €) + 1 cuivre (20 €) | 12 s | 70 € | 140 € | 1 750 € |
| Graveuse de circuits | 8 000 € | 1 stratifié (40 €) + 2 cuivre | 15 s | 80 € | 180 € | 2 000 € |
| Bobineuse | 9 000 € | 2 cuivre + 2 ferrite (30 €) | 20 s | 100 € | 240 € | 2 100 € |
| Ligne CMS | 25 000 € | 1 circuit nu + 2 condensateurs + 1 transformateur | 30 s | 320 € en matières | 900 € | 5 800 € |

Un mois de jeu dure 5 minutes simulées. Une première chaîne (quai de réception, machine, quai d’expédition, deux convoyeurs) coûte de 11 880 € à 14 880 € : le prêt de démarrage la finance. Une seule presse couvre deux fois sa mensualité. Les composants achetés à la boutique coûtent 30 % de plus que leur prix de vente : c’est une solution d’appoint, pas une source de profit. Les licences valent 20 000 € (spécialité), 40 000 € (CMS) et 80 000 € (ordinateurs). Ces valeurs sont des hypothèses de départ, à ajuster en jouant.

## Parcelles v0.9.1

| Achat | Prix | Total dépensé |
|---:|---:|---:|
| 1re parcelle | 10 000 € | 10 000 € |
| 2e | 15 000 € | 25 000 € |
| 3e | 20 000 € | 45 000 € |
| 6e | 35 000 € | 135 000 € |
| 12e (terrain complet) | 65 000 € | 450 000 € |

Une parcelle fait 32 × 32 tuiles : la première double presque l’espace utile pour 10 000 €, soit moins que la récompense de l’Entrepôt (10 000 €) qui ouvre l’achat. La suite sert d’objectif de long terme.

## Pièces v0.9.0

| Élément | Prix | Taille | Rôle |
|---|---:|---|---|
| Mur | 20 € | 1 × 1 | Ferme une pièce ; se trace au glisser |
| Porte | 150 € | 1 × 1 | Ferme une pièce comme un mur |
| Canapé | 400 € | 2 × 1 | 4 places en salle de repos |
| Machine à café | 600 € | 1 × 1 | Nécessaire à une salle de repos |
| Bureau de travail | 800 € | 2 × 1 | +1 candidat par vivier (3 au plus) |
| Filtre à air | 2 500 € | 1 × 1 | Avec un sol propre partout : salle blanche |
| Carrelage, parquet, sol propre | 10 €, 15 €, 40 € la tuile | — | Le sol propre est exigé en salle blanche |

Une pièce fait de 4 à 400 tuiles et ne touche pas le bord de la carte. Priorité des types : salle blanche, puis bureau, puis salle de repos. Une salle de repos de 12 tuiles avec un canapé et une machine à café coûte environ 1 500 € de murs, de porte et de mobilier (17 murs, une porte, un canapé, une machine à café). Elle couvre 4 employés. Une salle blanche autour d’un banc de test professionnel ramène les rebuts de 1 sur 8 à 1 sur 16, et jusqu’à 1 sur 64 avec la recherche et un opérateur de niveau 5. Les sols ne sont pas remboursés quand on les remplace.

## Personnel v0.8.0

| Niveau | Salaire de base / mois | Fourchette demandée | Durée d’un lot | Rebuts professionnels |
|---:|---:|---:|---:|---:|
| 1 | 600 € | 510 à 690 € | 125 % | 1 sur 8 |
| 2 | 800 € | 680 à 920 € | 110 % | 1 sur 8 |
| 3 | 1 000 € | 850 à 1 150 € | 100 % | 1 sur 8 |
| 4 | 1 300 € | 1 105 à 1 495 € | 90 % | 1 sur 12 |
| 5 | 1 700 € | 1 445 à 1 955 € | 80 % | 1 sur 16 |

Un mois dure 5 minutes simulées. Le vivier compte 5 candidats et change toutes les 3 minutes ; les niveaux 2 à 4 sortent le plus souvent. L’effectif est limité à 40. Un établi tenu par un opérateur de niveau 5 produit un PC bureautique toutes les 24 s au lieu de 30 s (12 s en Mk2). Les rebuts suivent la recherche Maîtrise de la qualité puis le niveau : 1 sur 16 devient 1 sur 32 au niveau 5.

En progression, le personnel devient obligatoire au jalon Conditionnement (récompense 12 000 €). Trois machines de production tenues par les opérateurs de base coûtent 2 400 € par mois. Hypothèse à vérifier en partie : les ventes de PC emballés, ouvertes au même jalon, couvrent cette charge.

## Boutique v0.7.0

| Lots d’un même composant dans le panier | Remise |
|---:|---:|
| 1 à 4 | 0 % |
| 5 à 9 | 5 % |
| 10 à 20 | 10 % |

La remise s’applique après le tarif du fournisseur : 10 lots de processeurs chez Relais Fret coûtent 18 000 € × 0,85 × 0,90 = 13 770 €, au lieu de 18 000 € chez Circuit Direct sans remise. Le quai de réception (100 unités, 200 après Quai agrandi) limite un panier à 10 lots, 20 avec la recherche. La plus forte remise demande donc tout le quai pour un seul composant. Le prix est arrondi au centime inférieur par ligne.

## Monnaies d’affichage v0.6.1

Toute l’économie est calculée en euros. L’interface convertit avec des taux fixes, arrondis depuis les cours de référence de la BCE de novembre 2026.

| Devise | Taux pour 1 € | Capital initial affiché | Langue par défaut |
|---|---:|---:|---|
| Euro (EUR) | 1 | 25 000 € | français, espagnol, allemand ; anglais en Irlande et à Malte |
| Dollar américain (USD) | 1,12 | 28 000 $ | anglais hors Royaume-Uni, Irlande et Malte |
| Livre sterling (GBP) | 0,83 | 20 750 £ | anglais au Royaume-Uni |
| Yuan (CNY) | 7,40 | 185 000 ¥ | chinois simplifié |
| Yen (JPY) | 178 | 4 450 000 ¥ | japonais |

Les prix ne sont pas adaptés au pouvoir d’achat local : seul l’affichage change.

## Catalogue de construction v0.1

| Équipement | Emprise au nord | Coût |
|---|---:|---:|
| Casier de stockage | 1 × 1 | 600 € |
| Établi d’assemblage | 2 × 2 | 1 800 € |
| Banc de test | 2 × 1 | 2 400 € |
| Quai de réception | 3 × 2 | 4 200 € |
| Convoyeur | 1 × 1 | 40 € |
| Répartiteur | 1 × 1 | 150 € |
| Fusionneur | 1 × 1 | 150 € |

Les coûts sont fictifs et réglables dans `packages/game-data/src/construction.ts`. Un exemplaire de chaque équipement coûte 9 000 €, laissant 16 000 € de capital. Un placement refusé ou une rotation laisse le solde intact.

Le remboursement de démolition vaut 50 % du prix effectivement payé, arrondi au centime inférieur. La différence reste une dépense de l’atelier. Pour un casier acheté à 600 €, le remboursement est de 300 € et la dépense définitive de 300 €.

## Production et progression v0.3

| Recette | Machine | Entrées | Durée |
|---|---|---|---:|
| PC bureautique assemblé | Établi d’assemblage | processeur, barrette, SSD, carte mère, alimentation, boîtier | 30 s |
| PC bureautique testé | Banc de test | PC assemblé | 10 s |
| PC bureautique emballé | Emballeuse (3 000 €) | PC testé, carton (3 €) | 8 s |

Chaque machine garde deux lots d’entrées et deux produits finis. Le PC bureautique n’utilise pas de carte graphique (GPU intégré) : 470 € de pièces.

| Palier | Jalon | Pièces à livrer | Débloque | Récompense |
|---|---|---|---|---:|
| 0 | Poste de montage | 10 boîtiers, 10 alimentations (1 000 €) | Établi d’assemblage | 1 500 € |
| 0 | Contrôle qualité | 5 PC assemblés (2 350 €) | Banc de test | 5 000 € |
| 0 | Flux maîtrisés | 10 PC testés (4 700 €) | Répartiteur, fusionneur | 7 500 € |
| 1 | Conditionnement | 20 PC testés (9 400 €) | Emballeuse, carton | 12 000 € |
| 1 | Entrepôt | 15 PC testés, 30 barrettes (8 250 €) | Entrepôt (2 500 €, 200 unités) | 10 000 € |
| 2 | Convoyeurs rapides | 20 PC emballés (9 460 €) | Convoyeur rapide (120 €) | 12 000 € |
| 2 | Subvention régionale | 30 PC emballés (14 190 €) | — | 25 000 € |

Au départ : Direction (gratuite, une seule), quai, casier, convoyeur, et les sept composants. Chaque récompense dépasse le prix des pièces demandées : un joueur qui garde de quoi acheter les pièces d’un jalon ne peut pas se bloquer. Il n’existe pas encore d’autre revenu (ventes en v0.4) : dépenser tout son capital en constructions peut bloquer la partie.

## Contrat phare et production gaming v0.3.1

| Objectif | Accès | Livraison | Coût des pièces | Récompense |
|---|---|---:|---:|---:|
| Contrat phare de l’Université de Valmont | Convoyeurs rapides et Subvention régionale terminés | 50 PC bureautiques emballés | 23 650 € | 38 000 € |
| Tournoi de Valmont | Contrat phare terminé | 20 PC gaming emballés | 14 060 € | 22 000 € |

Le contrat ouvre le palier 3. Cinquante PC correspondent à cinq lots par composant et demandent 25 minutes d’assemblage sur un seul établi à ×1. Plusieurs lignes réduisent le temps au prix d’un investissement supplémentaire.

Le modèle gaming ajoute une carte graphique 8 Go aux pièces de la recette bureautique. Il prend 45 s à assembler, 15 s à tester et 8 s à emballer. Un PC gaming emballé coûte 703 € en pièces et carton.

## Postes professionnels v0.3.2

Le tournoi de Valmont débloque le kit mémoire 32 Go (95 €) et le SSD 2 To (100 €). Ces composants remplacent la barrette 16 Go et le SSD 1 To de la recette gaming. Un poste professionnel coûte 800 € en pièces. Il prend 60 s à assembler, 20 s à tester et 8 s à emballer avec un carton à 3 €.

Le contrôle écarte chaque huitième poste à l’échelle de l’atelier. Chaque sortie possède un tampon de deux unités. Une ligne qui démarre produit ses dix premiers PC conformes à partir de onze postes assemblés. L’Institut Sorel paie 20 000 € pour ces dix produits emballés.

## Recherche et machines Mk2 v0.6.0

Le laboratoire R&D coûte 5 000 € et s’ouvre au jalon Contrôle qualité. Il n’a pas de stock propre : il n’accepte que les pièces encore attendues par le projet actif. Un seul projet reçoit des pièces à la fois ; les pièces déjà livrées à un projet mis en pause restent acquises. Une seule analyse tourne à la fois. Un nouveau projet peut recevoir ses pièces pendant l’analyse du précédent.

| Projet | Prérequis | Pièces | Coût des pièces | Analyse | Effet |
|---|---|---|---:|---:|---|
| Assemblage rapide | Flux maîtrisés | 20 PC bureautiques testés | 9 400 € | 60 s | Établi Mk2 |
| Tests automatisés | Conditionnement, Assemblage rapide | 15 PC bureautiques emballés | 7 095 € | 60 s | Banc de test Mk2 |
| Emballage continu | Tests automatisés | 25 PC bureautiques emballés | 11 825 € | 60 s | Emballeuse Mk2 |
| Quai agrandi | Entrepôt | 30 PC bureautiques testés | 14 100 € | 90 s | Quai de réception : 100 → 200 unités |
| Convoyeurs express | Contrat phare · Université de Valmont | 15 PC gaming emballés | 10 545 € | 120 s | Convoyeur express (300 €, 4 × la vitesse de base) |
| Maîtrise de la qualité | Postes de travail de l’Institut Sorel | 8 PC professionnels emballés | 6 424 € | 120 s | Rebuts professionnels : 1 sur 8 → 1 sur 16 |

| Amélioration Mk2 | Prix | Effet |
|---|---:|---|
| Établi d’assemblage | 3 000 € | Durée d’un lot divisée par deux (arrondi au tick supérieur) |
| Banc de test | 3 500 € | Idem |
| Emballeuse | 4 000 € | Idem |

Le prix de l’amélioration s’ajoute au prix payé de la machine : la démolition d’une machine Mk2 rembourse la moitié du total. Les projets ne versent pas de récompense : leur valeur est le gain de débit. Un établi Mk2 double la cadence pour 3 000 €, moins qu’un second établi (1 800 €) plus sa chaîne d’alimentation et la place qu’elle occupe. Ces valeurs sont des hypothèses de départ, à ajuster après des parties de test.

## Logistique v0.2 (tranche 1)

| Paramètre | Valeur |
|---|---:|
| Capacité du quai de réception | 100 unités |
| Capacité du casier de stockage | 40 unités |
| Vitesse d’un convoyeur | 1 tuile/s à ×1 |
| Unités par tuile de convoyeur | 2 |
| Débit d’un convoyeur | 2 unités/s à ×1 |
| Lot d’achat | 10 unités identiques |

Un répartiteur ou un fusionneur tient une seule unité à la fois et la transmet au tick suivant : il ne réduit pas le débit d’un convoyeur. Le filtre est gratuit et modifiable à tout moment. Une ligne tracée coûte 40 € par tuile.

Le quai sort par le port situé sous sa flèche. Le casier reçoit par l’arrière et sort par sa flèche. Un convoyeur coûte peu pour encourager l’essai de tracés, mais sa démolition rembourse aussi 50 %.

## Composants v0.2

| Composant | Fabricant fictif | Prix unitaire | Lot |
|---|---|---:|---:|
| Processeur 8 cœurs K8 | Arkelis | 180 € | 1 800 € |
| Carte graphique 8 Go V8 | Voltrane | 230 € | 2 300 € |
| Barrette 16 Go | Mnemora | 40 € | 400 € |
| SSD 1 To | Stratavault | 55 € | 550 € |
| Carte mère ATX B4 | Ferrolux | 95 € | 950 € |
| Alimentation 650 W | Kelvane | 55 € | 550 € |
| Boîtier standard | Carrène | 45 € | 450 € |

Un exemplaire de chaque pièce coûte 700 €, soit une marge brute indicative de 199 € pour un Gaming X1 vendu 899 €, avant main-d’œuvre, test et emballage. Ces valeurs restent à équilibrer avec la production (v0.3) et les ventes (v0.4). La commande est livrée immédiatement au quai : les délais et fournisseurs multiples arrivent en v0.4.

Les unités présentes dans un équipement démoli sont mises au rebut et comptées dans le registre, sans remboursement. Le dialogue de démolition annonce leur nombre.

Les délais de production et le calcul des marges relèvent des jalons de production et de vente.
