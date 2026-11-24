## Silicon Empire v0.1.0

Première version jouable de l’atelier de construction.

- Grille de 64 × 64 tuiles, caméra et zoom.
- Quatre équipements avec aperçu, rotation, inspection et démolition confirmée.
- Capital de départ de 25 000 € et remboursement de 50 % du prix payé à la démolition.
- Sauvegarde et reprise locales par atelier dans IndexedDB.

Décompressez `Silicon-Empire-v0.1.0.zip` et servez son contenu avec un serveur HTTP statique. Avec Python 3, lancez `python3 -m http.server 8000` depuis le dossier extrait, puis ouvrez `http://localhost:8000`. Conservez la même adresse pour retrouver vos sauvegardes.

Le lint, le typage, la compilation, 28 tests unitaires et 7 scénarios Chromium ont réussi.
