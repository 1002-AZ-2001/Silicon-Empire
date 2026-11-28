# Changelog

## 0.16.0 — Concurrents

- **Marchés** de la carrière : bobines de condensateurs, circuits imprimés nus, transformateurs, cartes électroniques, et les PC bureautiques, gaming et professionnels des contrats. Chaque marché a une demande mensuelle.
- Cinq **rivaux fictifs** entrent selon l’année : Helion Microdevices et Vortek Systems (1975), Norrland Data (1983), Kaori Denki (1986), Xinhe Electronics (1990). Chacun fournit une partie de la demande de ses marchés.
- **Indice de prix** par marché, de 60 % à 130 % du prix de référence. Chaque mois, il se rapproche à moitié du niveau que permet l’offre totale (rivaux et ventes de l’entreprise) : il baisse quand le marché déborde, il monte quand il manque de produits. Les rivaux augmentent leur offre de 10 % quand l’indice atteint 105 % et la réduisent sous 90 %.
- **Guerres de prix** : certains mois, un rival inonde un de ses marchés (+30 % de la demande) ; l’atelier affiche l’annonce. Les événements sont les mêmes dans chaque partie.
- L’indice s’applique aux ventes au grossiste, aux nouveaux contrats de PC et aux marchandises des usines vendues au grossiste de l’atelier ; les ventes de l’entreprise comptent dans l’offre du mois. Les marchés locaux à l’étranger gardent le prix de référence.
- Panneau **Concurrence** : demande, offre des rivaux, part de l’entreprise le mois dernier et indice de chaque marché ; rivaux et leurs volumes ; actualités. Le panneau Ventes affiche l’indice des prix du grossiste.
- La sauvegarde v18 enregistre marchés, rivaux et actualités. Les carrières précédentes rencontrent les rivaux de leur année, aux prix de référence.

## 0.15.0 — Carte du monde

- Nouvelle licence de carrière **Expansion internationale** (100 000 €, après l’assemblage de cartes CMS) et panneau **Monde** : carte stylisée des 8 régions, liste des régions, fiche de chaque région, routes des usines vers l’atelier et expéditions en cours.
- **Une usine par région** hors Europe de l’Ouest, où se trouve l’atelier : Europe de l’Est, Amérique du Nord, Mexique, Brésil, Inde, Chine, Japon et Corée. Les régions ouvrent avec l’histoire : Chine en 1980 (zone économique spéciale de Shenzhen), Europe de l’Est en 1990, Inde en 1991 (libéralisation) ; les autres sont ouvertes dès 1975.
- Chaque région a ses **coûts** (salaires, matériaux, prix de l’usine), son **marché local** et ses **délais** : bateau (camion depuis l’Europe de l’Est) de 3 à 36 jours, avion de 1 à 3 jours. Un jour de calendrier dure 10 secondes simulées (un mois de 30 jours = 5 minutes).
- Une usine fabrique chaque mois un produit au choix : bobines de condensateurs, circuits imprimés nus, transformateurs, cartes électroniques ou, avec la licence Ordinateurs, PC bureautiques emballés aux pièces de l’époque équipée. Le mois est payé en entier (frais fixes, matériaux, main-d’œuvre, fret) ou l’usine reste à l’arrêt.
- Trois **débouchés** : le marché local, le grossiste de l’atelier à l’arrivée, ou un quai de réception de l’atelier pour alimenter les chaînes. Un quai trop plein fait attendre l’expédition ; un quai démoli renvoie la marchandise au grossiste.
- La sauvegarde v17 enregistre les usines, les expéditions et les comptes à l’étranger. Les carrières précédentes commencent sans usine à l’étranger.

## 0.14.0 — Décor et paysage

- **Paysage** autour de l’usine : un trottoir, une route à deux voies avec lampadaires et bancs, puis des champs plantés d’arbres, de sapins, de buissons, de rochers et de fleurs. Le décor est le même dans chaque partie (placement pseudo-aléatoire fixe).
- Les **parcelles pas encore achetées** deviennent des champs, sous un voile plus léger ; une parcelle achetée redevient un sol d’usine. Un **mur extérieur à fenêtres** borde l’usine du côté des parcelles voisines.
- **Saisons** : l’herbe et les arbres suivent le mois du calendrier (neige et arbres nus de décembre à février, fleurs au printemps, vert l’été, feuilles rousses à l’automne). En carrière, le mois vient du calendrier de l’époque ; ailleurs, la partie commence en janvier.
- **Plante verte** (80 €, onglet Aménagement) : chaque plante dans un bureau ou une salle de repos ajoute 1 point de moral à chaque paie, 4 au plus. Le panneau Personnel affiche ce bonus.
- Correctif : le **poste informatique** de la v0.12.0 n’apparaissait dans aucun onglet de construction et ne pouvait pas être posé. Il est maintenant dans l’onglet Aménagement.
- La caméra peut aller jusqu’à 8 tuiles au-delà du terrain pour montrer le paysage.

## 0.13.0 — Époques

- **Année de départ** de la carrière, choisie au menu : 1975, 1985, 1995, 2005 ou 2017. Le **calendrier** avance d’un mois toutes les 5 minutes simulées (une période de paie) ; la date s’affiche dans l’en-tête. Les modes Classique et Bac à sable restent à l’époque moderne.
- Six **époques** de matériel, aux noms de fabricants fictifs, inspirées de l’histoire réelle du PC :
  - 1975, micro-ordinateurs 8 bits : processeur 8 bits 2 MHz, mémoire 4 Ko, lecteur de disquettes 8 pouces, carte mère bus S-100, alimentation linéaire, boîtier de bureau ;
  - 1983, PC 16 bits : processeur 4,77 MHz, mémoire 640 Ko, disque dur 10 Mo, carte mère ISA 8 bits ;
  - 1986, PC 32 bits : processeur 16 MHz, mémoire 1 Mo, disque dur 40 Mo, carte mère ISA 16 bits, alimentation AT 200 W, boîtier tour ;
  - 1997, multimédia et 3D : processeur 233 MHz, barrette 32 Mo, disque dur 4 Go, carte mère AGP, accélérateur 3D 4 Mo ;
  - 2005, 64 bits double cœur : barrette 1 Go, disque dur 250 Go, carte mère PCI Express, carte graphique 256 Mo ;
  - 2017, ère moderne : le catalogue existant.
- 26 nouvelles pièces dans la boutique, avec leurs icônes pixel art. Les pièces d’une époque restent en vente ensuite. La boutique affiche l’année de mise en vente et trie les pièces d’une même catégorie par année. Les pièces historiques n’apparaissent qu’en carrière.
- L’établi d’assemblage prend les pièces de l’**époque équipée**. Les modèles suivent l’époque : bureautique dès 1975, gaming dès 1997, professionnel (deux barrettes et deux disques) dès 2005. Les bancs de test et les emballeuses ne changent pas.
- Panneau **Époques** : date, époque équipée, pièces et modèles de chaque époque, délai avant les suivantes. Sans licence Ordinateurs, l’entreprise suit gratuitement chaque nouvelle époque. Ensuite, **rééquiper les chaînes** coûte une licence par époque franchie (20 000 € à 60 000 €), et l’établi ne doit plus garder de pièces de l’ancienne époque.
- **Obsolescence** : tant que les chaînes ont une ou plusieurs époques de retard, les nouveaux contrats paient 15 % de moins par époque (au plus −60 %). Un message annonce chaque nouvelle époque mise en vente.
- Le panneau Ventes affiche le prix réel des contrats (commerciaux et obsolescence compris). Son calcul de l’investissement net retire aussi les factures d’électricité et le rééquipement.
- La sauvegarde v16 enregistre l’année de départ, l’époque en vente, l’époque équipée et le rééquipement payé. Les carrières précédentes passent en 2017 à l’époque moderne : elles gagnent les modèles gaming et professionnel avec la licence Ordinateurs.

## 0.12.0 — Rôles des employés et menu Entreprise

- Chaque candidat a un **rôle**. Le premier candidat de chaque vivier est toujours un opérateur ; le salaire dépend du rôle (de 90 % à 150 % de celui d’un opérateur de même niveau) et est arrondi à l’euro.
  - **Opérateur** : tient une machine de production (comme avant).
  - **Technicien de maintenance** : retire toutes les 30 secondes 2 points d’usure par niveau de compétence à la machine la plus usée.
  - **Magasinier** : affecté à un quai de réception, il commande un lot en livraison immédiate dès qu’un article de sa liste de **réassort** (4 au plus, réglée dans l’inspecteur du quai) tombe sous 10 unités.
  - **Chercheur R&D** : chaque chercheur ajoute un tick d’analyse au laboratoire (3 au plus, soit des analyses jusqu’à 4 fois plus rapides).
  - **Développeur** : −10 % sur la durée des tests par développeur (3 au plus).
  - **Concepteur** : −10 % sur le prix des améliorations Mk2 et Mk3 par concepteur (3 au plus).
  - **Manager** : +5 de moral à chaque paie versée par manager (2 au plus).
  - **Commercial** : +5 % sur les prix des nouvelles commandes clients et du grossiste par commercial (4 au plus).
- Les rôles de bureau (chercheur, développeur, concepteur, manager, commercial) n’agissent qu’avec un **poste informatique** (1 500 €) placé dans un bureau, à raison d’un poste par personne, dans l’ordre d’embauche.
- Les rôles s’ouvrent avec la progression : magasinier à l’Entrepôt (Classique) ou à l’assemblage CMS (Carrière), chercheur avec le laboratoire, développeur au Contrôle qualité ou à l’assemblage d’ordinateurs, concepteur et commercial au Conditionnement ou à l’Automatisation (le commercial est ouvert dès le début en carrière).
- **Menu Entreprise** : couleur et emblème de l’entreprise (affichés dans l’en-tête), effectifs et effet de chaque rôle, postes informatiques disponibles.
- La sauvegarde v15 enregistre les rôles, les listes de réassort et l’identité. Les employés des versions précédentes deviennent des opérateurs ; les candidats gardent leurs noms et niveaux et reçoivent un rôle.

## 0.11.0 — Électricité, usure, Mk3 et interface triée

- **Électricité** dans les nouveaux ateliers. Les machines de production et le laboratoire consomment de 6 à 30 kW, davantage en Mk2 et Mk3. Elles prennent le courant sur le réseau de **câbles** qu’elles touchent : sur leur emprise ou juste à côté. Le câble coûte 5 € la tuile, se trace au glisser et passe sous les bâtiments et les convoyeurs ; l’outil « Retirer un câble » l’enlève.
- Sources d’énergie : **raccordement au réseau** (5 000 €, 150 kW, facturé 12 € par kW consommé et par mois) et **groupe électrogène** (8 000 €, 60 kW, 400 € de carburant par mois). Sans câble, une machine ne démarre pas ; quand la demande dépasse l’offre, les lots ralentissent dans la même proportion. Une facture impayée coupe le réseau jusqu’au paiement suivant.
- **Usure** : chaque lot use la machine (2 points en Mk1 et Mk2, 1 en Mk3). À 140 points, les lots prennent 25 % de temps en plus. À 200, la machine tombe en panne. La réparation coûte 10 % de ce que la machine a coûté.
- **Mk3** : trois fois plus rapide que Mk1, deux fois moins d’usure, double consommation. Mk2 et Mk3 s’étendent aux machines de la carrière. Classique : recherche « Automatisation avancée ». Carrière : licences « Automatisation » (Mk2, 30 000 €) puis « Robotique » (Mk3, 60 000 €).
- **Construction triée** par onglets : Tout, Logistique, Production, Énergie, Aménagement. Les outils suivent cet ordre.
- **Boutique** : barre de recherche, sans tenir compte des accents ni des majuscules, et tri par catégorie, nom ou prix.
- Le tutoriel de carrière ajoute l’étape du raccordement électrique. L’inspecteur affiche consommation, équilibre du réseau, usure et facture estimée.
- La sauvegarde v14 enregistre câbles, usure, factures et niveaux Mk3. Les ateliers précédents continuent sans électricité ni usure.

## 0.10.0 — Mode Carrière et tutoriel

- Nouveau mode **Carrière**, choisi par défaut : l’entreprise démarre avec 0 €. Les modes **Classique** (l’ancienne progression) et **Bac à sable** restent proposés dans le menu.
- Choix d’une **spécialité** de départ, gratuite : composants passifs (presse à condensateurs), circuits imprimés (graveuse) ou énergie (bobineuse). Quatre matières premières arrivent à la boutique : poudre céramique, feuille de cuivre, stratifié verre-époxy et noyau de ferrite.
- **Banque** : trois prêts (20 000 € à 4 % sur 24 mois, 50 000 € à 6 % sur 24 mois, 100 000 € à 9 % sur 36 mois). Mensualités prélevées à chaque mois de jeu, remboursement anticipé du capital restant, faillite après trois mensualités impayées d’affilée.
- Le quai d’expédition vend les composants au **grossiste**, à prix fixe : bobine de condensateurs 140 €, circuit imprimé nu 180 €, transformateur 240 €, carte électronique 900 €.
- **Technologies** : licences des autres spécialités (20 000 €), assemblage de cartes CMS (40 000 €, deux spécialités) avec la ligne CMS, puis assemblage d’ordinateurs (80 000 €) qui ouvre les machines et composants de PC.
- **Tutoriel guidé** en neuf étapes, en surimpression sur la carte, avec surbrillance du bouton ou de l’outil concerné ; masquable et relançable. Guide écrit : `docs/HOW_TO_PLAY.md`.
- Un stock relié par convoyeurs à une machine de production envoie l’ingrédient qui lui manque, en tenant compte des unités déjà en route, et n’envoie rien quand la machine n’a besoin d’aucun des articles stockés. Un seul quai peut ainsi nourrir une recette à plusieurs ingrédients sans bloquer le convoyeur.
- La barre de construction tient sur deux lignes qui défilent latéralement : les nouveaux équipements ne réduisent plus la carte.
- La trésorerie du panneau Ventes déduit aussi les salaires, le terrain, les emprunts et les licences de la construction nette.
- La sauvegarde v13 enregistre la carrière. Les ateliers précédents s’ouvrent en mode Classique ou Bac à sable, comme avant.

## 0.9.1 — Parcelles

- Le terrain fait maintenant 128 × 128 tuiles, découpé en 16 parcelles de 32 × 32. Un atelier commence avec les 4 parcelles du nord-ouest, soit le 64 × 64 des versions précédentes.
- Les parcelles non possédées sont voilées. Celles qui touchent le terrain sont encadrées et affichent leur prix. Un clic dessus ouvre la parcelle dans l’inspecteur, avec le bouton d’achat.
- Prix : 10 000 € la première parcelle, puis 5 000 € de plus à chaque achat. En progression, l’achat s’ouvre au jalon Entrepôt ; le bac à sable peut acheter dès le départ.
- Construire ou peindre un sol hors du terrain possédé est refusé avec un message dédié. La caméra se centre sur le terrain possédé.
- Le sol de béton est dessiné par motif répété : le terrain plus grand ne charge pas une texture de 4096 × 4096.
- La sauvegarde v12 enregistre les parcelles. Les ateliers précédents gardent leurs bâtiments aux mêmes coordonnées ; leurs sols sont réindexés.

## 0.9.0 — Murs, sols et pièces

- Nouveaux éléments de construction : mur (20 €, tracé au glisser comme un convoyeur), porte (150 €), canapé (400 €, 2 × 1), machine à café (600 €), bureau de travail (800 €, 2 × 1) et filtre à air (2 500 €).
- Sols peints au glisser, sous les machines : carrelage (10 € la tuile), parquet (15 €) et sol de salle blanche (40 €). Le béton nu retire un revêtement gratuitement.
- Une zone entourée de murs et de portes, qui ne touche pas le bord de la carte et fait de 4 à 400 tuiles, devient une pièce. Son type dépend du mobilier :
  - **salle blanche** : un filtre à air et le sol de salle blanche sur toutes les tuiles. Les bancs de test entièrement à l’intérieur écartent deux fois moins de PC professionnels ;
  - **bureau** : chaque bureau de travail ajoute un candidat aux prochains viviers, trois au plus ;
  - **salle de repos** : un canapé et une machine à café. Chaque canapé assoit 4 employés. Si tout le personnel a une place, une paie versée donne +20 de moral au lieu de +10, et une paie manquée retire 25 au lieu de 40.
- Les pièces sont teintées et nommées sur la carte. L’inspecteur d’un meuble indique sa pièce et son effet ; le panneau Personnel résume les places assises et les candidats en plus.
- En progression, murs, portes, sols, canapé, café et bureau s’ouvrent au Conditionnement, le filtre à air au tournoi de Valmont.
- La sauvegarde v11 enregistre les sols. Les ateliers précédents reprennent sur béton nu.

## 0.8.0 — Personnel

- Le panneau **Personnel** propose cinq candidats fictifs avec un niveau de 1 à 5 et un salaire demandé entre 85 % et 115 % du salaire de leur niveau. Le vivier se renouvelle toutes les 3 minutes simulées ; il est identique dans toutes les parties.
- Un employé s’affecte à un établi, un banc de test ou une emballeuse, depuis le panneau ou l’inspecteur de la machine. Son niveau fixe la durée des lots, de 125 % (niveau 1) à 80 % (niveau 5). Aux niveaux 4 et 5, le contrôle professionnel écarte 1,5 et 2 fois moins de postes.
- Les salaires sont prélevés toutes les 5 minutes simulées. Une paie versée augmente le moral ; une paie impossible le baisse de 40 points, et l’employé part à 0. Le licenciement coûte une demi-mensualité.
- En progression, après le jalon Conditionnement, une machine de production sans opérateur termine son lot puis s’arrête et affiche « Sans opérateur ». À ce jalon, la Direction affecte un opérateur de niveau 2 à chaque machine de production déjà construite. Le bac à sable n’exige jamais d’opérateur.
- La sauvegarde v10 enregistre le personnel, le vivier et le calendrier de paie. Les ateliers v1 à v9 reprennent sans employés ; ceux qui ont passé le Conditionnement en progression reçoivent les opérateurs de base.
- Les boutons des panneaux forment une barre sous les indicateurs de l’en-tête : l’atelier ne déborde plus de l’écran.

## 0.7.0 — Boutique de composants

- Le bouton **Boutique** ouvre le catalogue des composants, filtrable par catégorie, avec le prix unitaire et le prix du lot de 10 chez le fournisseur choisi. Les composants verrouillés indiquent le jalon qui les débloque.
- Le panier regroupe plusieurs composants et plusieurs lots, jusqu’à 20 lots par composant. Il reste rempli quand on ferme la boutique.
- Remise de volume par composant : −5 % dès 5 lots, −10 % dès 10 lots. Elle se cumule avec le tarif de Relais Fret.
- La commande vise un quai de réception choisi. Tout le panier passe ou rien ne passe : capital, place libre au quai et composants débloqués sont vérifiés d’un coup. Les lots de Relais Fret réservent leur place jusqu’à leur arrivée.
- La commande d’un lot depuis l’inspecteur du quai reste disponible. Le format de sauvegarde ne change pas.

## 0.6.1 — Monnaies

- Les montants s’affichent dans la monnaie de la langue : euro en français, espagnol et allemand, dollar ou livre en anglais selon la région du système (euro pour l’Irlande et Malte), yuan en chinois, yen en japonais.
- Le sélecteur **Devise** du menu principal impose une autre monnaie parmi euro, dollar américain, livre sterling, yuan et yen. Ce choix reste sur l’appareil.
- La conversion utilise des taux fixes arrondis depuis les cours de référence de la BCE de novembre 2026 : 1 € = 1,12 $ = 0,83 £ = 7,40 ¥ (CNY) = 178 ¥ (JPY). Le yen s’affiche sans décimales.
- Le moteur compte toujours en centimes d’euro : une sauvegarde reste identique quelle que soit la langue ou la devise.
- Le menu principal passe sur deux lignes sur les écrans étroits.

## 0.6.0 — Laboratoire R&D et machines Mk2

- Le laboratoire R&D (5 000 €, 2 × 2 tuiles) s’ouvre au jalon Contrôle qualité. Il reçoit par convoyeur les pièces du projet choisi dans le panneau **Recherche**.
- Six projets : Assemblage rapide, Tests automatisés, Emballage continu, Quai agrandi, Convoyeurs express et Maîtrise de la qualité. Une fois les pièces reçues, l’analyse dure de 60 à 120 secondes simulées et ne progresse que si un laboratoire est en place.
- Les établis, bancs de test et emballeuses passent en Mk2 sur place depuis l’inspecteur. Une machine Mk2 fabrique deux fois plus vite. L’amélioration coûte 3 000 €, 3 500 € ou 4 000 € et la démolition rembourse la moitié du total payé.
- Le convoyeur express (300 €) avance quatre fois plus vite que le convoyeur de base. Le quai agrandi stocke 200 unités. La maîtrise de la qualité réduit les rebuts professionnels à un poste sur seize.
- En bac à sable, le laboratoire, le convoyeur express et les améliorations Mk2 sont disponibles d’emblée. Les bonus de quai et de qualité passent par la recherche, sans prérequis de jalon.
- La sauvegarde v9 enregistre la recherche et le niveau des machines. Les ateliers v1 à v8 reprennent sans recherche, avec des machines Mk1.

## 0.5.0 — Guide d’atelier, sauvegardes portables et Docker

- Le guide d’atelier suit les étapes de la construction du quai de réception au règlement de la première commande client.
- Export JSON et import sous forme de copie depuis le menu principal. Les fichiers sont vérifiés et les anciens formats sont migrés à la lecture.
- Un conteneur Caddy sert le jeu compilé. Docker Compose permet de le lancer sur un port configurable.

## 0.4.1 — Conception de PC et fournisseurs

- Conception d’un PC avec mémoire, SSD, graphismes et alimentation configurables. La puissance requise inclut une marge de 20 %.
- Les machines de production et les commandes clients utilisent la révision validée. L’historique garde le nom, les pièces et le tarif des modèles vendus.
- Relais Fret facture 15 % de moins et livre après 90 secondes simulées. Circuit Direct livre immédiatement au prix catalogue.
- Les lots en attente réservent leur place au quai. Le format v8 enregistre le modèle et les livraisons réservées.

## 0.4.0 — Expédition et ventes

- Le quai d’expédition, débloqué par le jalon Conditionnement, reçoit les PC emballés pour les commandes clients répétables.
- Une commande immobilise son tarif et est payée en une fois à la dernière livraison. Les livraisons partielles restent dans la sauvegarde.
- Le panneau Ventes affiche les revenus, les subventions, les achats, la construction nette et la marge estimée aux coûts matière de référence.
- Les sauvegardes v1 à v6 reprennent au format v7.

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
