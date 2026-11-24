# Installer et lancer Silicon Empire

Silicon Empire s’installe comme une application de bureau sur Windows et Linux. Le jeu fonctionne hors ligne. Internet sert seulement à vérifier et télécharger les mises à jour.

## 1. Télécharger

Ouvrir la page des versions : <https://github.com/1002-AZ-2001/Silicon-Empire/releases/latest>

Dans **Assets**, choisir le fichier adapté à son système (`X.Y.Z` est le numéro de version) :

| Système | Fichier |
|---|---|
| Windows 10 ou 11 (64 bits) | `Silicon-Empire-Setup-X.Y.Z.exe` |
| Debian 12 ou 13, Ubuntu (64 bits) | `Silicon-Empire-X.Y.Z-amd64.deb` |
| Arch Linux et dérivées (64 bits) | `Silicon-Empire-X.Y.Z-x64.pacman` |
| Toute distribution Linux 64 bits, sans installation | `Silicon-Empire-X.Y.Z-x86_64.AppImage` |

Le fichier `Silicon-Empire-vX.Y.Z.sha256` contient l’empreinte de chaque fichier publié. Le fichier `…-web.zip` sert à héberger la version navigateur ; il n’est pas nécessaire pour jouer sur son ordinateur.

### Vérifier le téléchargement (facultatif)

Sous Linux, dans le dossier du téléchargement :

```bash
sha256sum --ignore-missing -c Silicon-Empire-vX.Y.Z.sha256
```

Sous Windows, dans PowerShell, comparer le résultat avec la ligne correspondante du fichier `.sha256` :

```powershell
Get-FileHash .\Silicon-Empire-Setup-X.Y.Z.exe -Algorithm SHA256
```

## 2. Installer

### Windows

1. Double-cliquer sur `Silicon-Empire-Setup-X.Y.Z.exe`.
2. L’installeur n’est pas encore signé numériquement. Windows peut afficher « Windows a protégé votre ordinateur ». Cliquer sur **Informations complémentaires**, puis **Exécuter quand même**.
3. Choisir l’installation pour l’utilisateur courant : elle ne demande aucun droit administrateur. L’installation pour tous les utilisateurs demande une confirmation administrateur. Choisir ensuite le dossier, puis terminer.
4. Lancer **Silicon Empire** depuis le menu Démarrer ou le raccourci du bureau.

Désinstaller : **Paramètres** → **Applications** → **Silicon Empire** → **Désinstaller**. Les sauvegardes sont conservées.

### Debian et Ubuntu

```bash
sudo apt install ./Silicon-Empire-X.Y.Z-amd64.deb
```

Garder le `./` : il indique à `apt` d’installer le fichier local et ses dépendances. Lancer ensuite **Silicon Empire** depuis le menu des applications, ou :

```bash
silicon-empire
```

Désinstaller :

```bash
sudo apt remove silicon-empire
```

### Arch Linux

```bash
sudo pacman -U Silicon-Empire-X.Y.Z-x64.pacman
```

Lancer **Silicon Empire** depuis le menu des applications, ou avec `silicon-empire`. Désinstaller :

```bash
sudo pacman -R silicon-empire
```

### AppImage (toutes distributions)

```bash
chmod +x Silicon-Empire-X.Y.Z-x86_64.AppImage
./Silicon-Empire-X.Y.Z-x86_64.AppImage
```

L’AppImage a besoin de la bibliothèque FUSE 2. Si elle ne démarre pas et parle de `libfuse.so.2`, installer `libfuse2t64` sous Debian 13 et Ubuntu 24.04 (`libfuse2` sous Debian 12), ou `fuse2` sous Arch.

## 3. Jouer

Au premier lancement, saisir un nom d’atelier puis cliquer sur **Nouvelle partie**. Les commandes sont décrites dans le [README](../README.md#jouer-en-local). Pour reprendre une partie, choisir l’atelier dans **Ateliers enregistrés**.

Les sauvegardes restent sur l’ordinateur, dans le profil de l’utilisateur :

| Système | Dossier |
|---|---|
| Windows | `%APPDATA%\silicon-empire` |
| Linux | `~/.config/silicon-empire` |

Elles sont conservées lors des mises à jour et de la désinstallation. Sauvegarder ce dossier permet de les garder ailleurs.

## 4. Mettre à jour

Au lancement, le menu principal vérifie s’il existe une version plus récente. L’état s’affiche en bas à droite, à côté du numéro de version.

1. Quand **Version X.Y.Z disponible** apparaît, le lien **Nouveautés** ouvre les notes de version dans le navigateur.
2. Cliquer sur **Télécharger**. La progression s’affiche.
3. Cliquer sur **Redémarrer pour installer**. Le jeu se ferme, installe la mise à jour et redémarre.

Rien n’est téléchargé ni installé sans clic. Avec les paquets `.deb` et `.pacman`, le système demande le mot de passe administrateur pour installer la mise à jour. Avec l’AppImage, le fichier est remplacé par la nouvelle version.

Le message **Mise à jour impossible : Aucune version publiée trouvée sur GitHub** signifie que la page des versions n’est pas accessible publiquement ou ne contient encore aucune version. **Connexion à GitHub impossible** signale un problème réseau ; le jeu reste jouable.

On peut aussi mettre à jour manuellement : télécharger le nouveau fichier et l’installer par-dessus l’ancien, comme à l’étape 2.

## 5. Lancer depuis le code source (développeurs)

Prérequis : Git, [Node.js 24](https://nodejs.org/) et pnpm 11.25.0 (`corepack enable` l’active à partir du champ `packageManager`).

```bash
git clone https://github.com/1002-AZ-2001/Silicon-Empire.git
cd Silicon-Empire
pnpm install --frozen-lockfile
```

| Commande | Effet |
|---|---|
| `pnpm dev` | Lance la version navigateur ; ouvrir l’adresse affichée |
| `pnpm desktop` | Construit le jeu et l’ouvre dans l’application de bureau, sans mise à jour |
| `pnpm desktop:dist` | Construit les paquets du système courant dans `release/` |

Sous Linux, construire le paquet pacman demande `bsdtar` (paquet `libarchive-tools` sous Debian). Les paquets Windows se construisent sous Windows. La version navigateur et l’application de bureau ont des sauvegardes séparées.
