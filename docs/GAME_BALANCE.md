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
