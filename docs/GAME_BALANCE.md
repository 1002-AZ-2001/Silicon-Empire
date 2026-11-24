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

Les coûts sont fictifs et réglables dans `packages/game-data/src/construction.ts`. Un exemplaire de chaque équipement coûte 9 000 €, laissant 16 000 € de capital. Un placement refusé ou une rotation laisse le solde intact.

Le remboursement de démolition vaut 50 % du prix effectivement payé, arrondi au centime inférieur. La différence reste une dépense de l’atelier. Pour un casier acheté à 600 €, le remboursement est de 300 € et la dépense définitive de 300 €.

Les capacités, les délais et le calcul des marges relèvent des jalons d’inventaire, de production et de vente.
