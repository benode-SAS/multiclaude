# multiclaude

Chat multi-utilisateur temps réel au-dessus de **Claude Code**. Plusieurs personnes
dialoguent dans une même conversation avec un agent qui travaille dans un dossier
isolé : réponses en flux, actions visibles, fichiers créés affichés en direct, et
validation humaine avant toute commande sensible.

> Chaque conversation pilote un vrai process `claude` sur la machine hôte, avec votre
> abonnement Claude — pas de clé API, pas d'intermédiaire.

---

## Ce que ça fait

**Travailler à plusieurs sur un même agent.** Une conversation, un contexte, plusieurs
personnes. On voit qui écrit, ce qu'il est en train d'écrire (au survol), où il se
trouve dans le fil, et ce qu'il a sélectionné — surligné à sa couleur, comme dans un
document partagé. Cliquer sur un badge met votre vue en miroir de la sienne.

**Ne pas se marcher dessus.** L'agent traite un tour à la fois : les messages
concurrents sont mis en file, épinglés au-dessus de la saisie, modifiables ou
annulables tant qu'ils ne sont pas partis. Un tour peut être interrompu. Et une
conversation peut être **forkée** : mêmes fichiers, même contexte hérité, deux fils qui
divergent — pour explorer sans abîmer le travail de l'autre.

**Garder la main sur ce qui s'exécute.** Les commandes anodines passent seules ; `sudo`,
`pg_dump`, `git push`, `docker`, une suppression hors du dossier de travail ou un accès
aux secrets demandent un clic, avec le motif affiché. La politique est testée.

**Voir le travail.** Les fichiers écrits par l'agent apparaissent dans le fil et dans un
panneau latéral redimensionnable. Markdown, code et HTML sont rendus, avec défilement et
sélections partagés entre participants. Un document modifié pendant sa lecture se
rafraîchit sans perdre la position.

---

## Démarrer

### Prérequis

- [Bun](https://bun.sh) 1.3+
- [Claude Code](https://claude.com/claude-code) installé et accessible dans le `PATH`
- `git` (pour cloner un dépôt dans une conversation)

### En local

```bash
git clone https://github.com/benode-SAS/multiclaude.git
cd multiclaude
cp .env.example .env
bun install
bun run db:migrate
bun run dev
```

L'interface écoute sur `http://localhost:3000`, l'API sur `8000`.

Au premier lancement l'application demande de **créer le compte administrateur** —
c'est le premier compte créé, quel que soit le réglage des inscriptions.

Il reste à connecter Claude Code : la clé 🔑 dans la barre latérale ouvre un lien
d'autorisation, puis vous collez le code renvoyé. Aucun terminal nécessaire.

### En production

```bash
cp .env.example .env    # renseignez au moins PORT, DATA_DIR, PUBLIC_URL
bun run deploy          # install + build + migrations
bun run start
```

`SERVE_WEB` étant actif par défaut, le serveur sert aussi l'interface : **un seul
port**, pas de CORS, WebSocket en même origine.

### Docker

```bash
docker build -t multiclaude .
docker run -p 8000:8000 -v multiclaude-data:/data \
  -e PUBLIC_URL=https://multiclaude.example.com \
  -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD='motdepasse-solide' \
  multiclaude
```

Tout l'état — base SQLite, dossiers de travail, identifiants Claude — tient dans
`/data`. C'est le seul volume à sauvegarder.

Sur Railway, Fly ou équivalent : pointez le service sur ce `Dockerfile`, attachez un
volume persistant sur `/data`, et renseignez `PUBLIC_URL`. Sans volume, chaque
redéploiement repart de zéro.

---

## Gérer les comptes

Le premier compte créé est administrateur. Il ouvre ensuite ⚙ → **Utilisateurs** pour
ajouter quelqu'un : l'application génère un mot de passe temporaire, affiché une seule
fois, que l'intéressé remplace obligatoirement à sa première connexion. La clé 🔑 en
regard d'un compte régénère ce mot de passe — même règle ensuite.

Cela fonctionne quel que soit le réglage des inscriptions : `SIGNUP_ENABLED` ne
concerne que le formulaire public.

Les mêmes opérations existent en ligne de commande, utile quand plus personne ne peut
se connecter :

```bash
bun run cli users list
bun run cli users add alice@example.com "Alice Martin" --admin
bun run cli users password alice@example.com    # régénère le mot de passe
bun run cli users role alice@example.com member
bun run cli users remove alice@example.com
```

Le CLI applique les mêmes garde-fous que l'interface : il refuse de retirer le dernier
administrateur, et applique les migrations si la base n'est pas à jour.

---

## Configuration

Tout se règle dans un `.env` à la racine ; `.env.example` documente chaque variable.
Les plus structurantes :

| Variable | Rôle |
| --- | --- |
| `PORT` | Port de l'API et de l'interface |
| `PUBLIC_URL` | URL publique — sert aux cookies de session |
| `DATA_DIR` | Base, dossiers de travail, identifiants. Le seul dossier à sauvegarder |
| `SIGNUP_ENABLED` | Formulaire public d'inscription. Un administrateur crée des comptes dans tous les cas |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Crée l'administrateur au démarrage, sans intervention |
| `CLAUDE_CONFIG_DIR` | Où le CLI range ses identifiants. Le pointer dans `DATA_DIR` rend le déploiement autonome |
| `ALWAYS_ASK_TOOLS` | Outils qui demandent toujours confirmation. `Bash` pour tout verrouiller |
| `ASK_PATTERNS` | Motifs supplémentaires déclenchant une demande, ex. `prod,deploy\.sh` |
| `CLONE_DEPTH` | Profondeur du clone à la création d'une room. `0` pour l'historique complet |

---

## Sécurité — à lire avant d'exposer l'instance

**L'agent exécute du code sur la machine hôte.** C'est l'intérêt de l'outil, et son
risque. Trois points comptent :

1. **Ne le faites pas tourner en `root`.** Créez un utilisateur dédié. La politique de
   permissions demande confirmation avant les commandes dangereuses, mais elle
   fonctionne par liste de refus : une commande destructrice non prévue passera.
   Pour verrouiller, `ALWAYS_ASK_TOOLS=Bash` fait confirmer chaque commande.

2. **Tout compte peut lancer des commandes.** Il n'y a pas de bac à sable entre les
   membres : donnez des comptes à des gens de confiance, et fermez les inscriptions
   (`SIGNUP_ENABLED=false`) sur une instance accessible depuis Internet.

3. **L'aperçu HTML exécute du JavaScript**, dans une origine opaque (`sandbox`
   sans `allow-same-origin`) : la page ne peut atteindre ni l'application, ni le
   stockage, ni l'API. Elle peut en revanche émettre des requêtes sortantes.

---

## Architecture

Monorepo Bun : `apps/server` (Elysia + WebSocket), `apps/web` (React + Vite),
`packages/shared` (contrat WebSocket et types partagés).

**Une room = un process `claude`**, piloté en `stream-json` sur stdin/stdout et gardé
vivant entre les tours pour conserver son contexte. S'il meurt, il repart en `--resume`
sur la même session. Le fork dérive la session parente.

**Les permissions passent par un hook `PreToolUse`** qui appelle le serveur et bloque
jusqu'au clic d'un humain. C'est ce qui permet d'arbitrer depuis l'interface plutôt que
depuis un terminal.

**Les changements de fichiers viennent d'un rescan du dossier**, pas des seuls
événements système : l'agent écrit via un fichier temporaire puis renomme, et le nom
final n'apparaît jamais dans l'événement.

**L'état des rooms vit en mémoire** — d'où un seul process serveur, jamais de mode
cluster.

```bash
bun run dev        # serveur + interface en watch
bun run check      # lint et formatage (Biome)
bun run typecheck
bun run test
```

---

## Contribuer

Les issues et les pull requests sont bienvenues. Avant de proposer un changement :
`bun run check`, `bun run typecheck` et `bun run test` doivent passer — c'est ce que
vérifie la CI.

Le code est commenté en expliquant *pourquoi* une décision a été prise quand elle n'est
pas évidente, pas *ce que* fait la ligne suivante. Merci de garder cette habitude.

## Licence

MIT — voir [LICENSE](LICENSE).
