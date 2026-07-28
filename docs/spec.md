# Specs — Chat Claude Code multi-utilisateur (v1)

## Objectif

Application web permettant à plusieurs personnes de dialoguer **en temps réel dans une même conversation** avec un agent Claude Code. Chaque conversation ("room") pilote un process Claude Code isolé avec son propre workdir. Streaming des réponses et des actions (fichiers, commandes) vers tous les participants connectés. Historique persistant, reprise à la reconnexion.

Usage initial : interne, 2-3 personnes. Priorité : **simple et pleinement fonctionnel**, pas scalable.

## Décisions actées

- **Rooms** : plusieurs conversations créables à la volée.
- **Workdir** : un par room, isolé.
- **Auth** : aucune, juste un pseudo saisi à l'entrée (stocké côté client, envoyé à chaque message).

## Stack

- **Backend** : Elysia (Bun), WebSocket natif, REST pour upload/download fichiers.
- **Agent** : `@anthropic-ai/claude-agent-sdk`, un appel `query()` par turn, session reprise via `session_id`.
- **DB** : SQLite + Drizzle. Un fichier `data/app.db`.
- **Front** : React + Vite, TypeScript. Design inspiré de Claude chat (cf. section Design).
- **Fichiers** : sur disque dans `data/rooms/<roomId>/workdir/`. La DB ne stocke que les métadonnées.

## Modèle de données (Drizzle / SQLite)

```
rooms
  id            text pk (nanoid)
  title         text            -- éditable, défaut "Nouvelle conversation"
  session_id    text nullable   -- session_id Claude Code, set après le 1er turn
  workdir       text            -- chemin absolu
  status        text            -- 'idle' | 'running'
  created_at    integer
  updated_at    integer

messages
  id            text pk (nanoid)
  room_id       text fk
  author        text            -- pseudo de l'humain, ou 'claude'
  role          text            -- 'user' | 'assistant' | 'system'
  content       text            -- markdown pour affichage
  created_at    integer

events          -- trace des actions de l'agent pour re-render (tool_use, tool_result…)
  id            text pk
  room_id       text fk
  turn_id       text            -- regroupe les events d'un même turn
  seq           integer         -- ordre au sein du turn
  type          text            -- 'tool_use' | 'tool_result' | 'file_change' | 'text'
  payload       text (json)
  created_at    integer

attachments     -- fichiers uploadés par un user OU générés par Claude
  id            text pk
  room_id       text fk
  message_id    text fk nullable   -- rattaché à un message (upload user) si applicable
  source        text               -- 'user' | 'claude'
  filename      text
  rel_path      text               -- chemin relatif au workdir
  mime          text
  size          integer
  created_at    integer
```

## Cycle de vie d'un turn

Le SDK Agent est **tour-par-tour** : un seul turn peut tourner à la fois par room. Il faut une **queue FIFO par room** + un état `idle | running`.

1. Un user envoie un message (via WS).
2. Si `status = running` → le message est empilé dans la queue de la room, un event `queued` est broadcasté (les autres voient "message en attente").
3. Si `status = idle` → on passe `running`, on lance le turn.
4. Le message user est persisté (`messages`) et broadcasté immédiatement à tous.
5. On appelle `query()` avec `resume: room.session_id` (undefined au 1er turn), `cwd: room.workdir`.
6. On itère le stream d'events du SDK :
    - `system/init` → on capture/maj le `session_id`.
    - `assistant` (texte) → broadcast incrémental + accumulation.
    - `assistant` (tool_use) → persist `events`, broadcast (les clients affichent "Claude écrit `src/x.ts`", "Claude exécute `bash …`").
    - `user` (tool_result) → persist `events`, broadcast.
    - `result` (fin de turn) → persist le message assistant final, maj `session_id`, broadcast `turn_end`.
7. Passage à `idle`, puis dépilage : s'il y a un message en queue, on relance un turn.

**Auteur dans le prompt** : chaque message envoyé au SDK est préfixé par le pseudo, `[Benjamin]: …`, pour que Claude distingue qui parle dans une conversation multi-utilisateur.

## Gestion des fichiers

Deux mécanismes complémentaires :

**1. Détection via events** — les `tool_use` de type `Write`/`Edit` donnent le chemin et le diff. Suffisant pour notifier ("Claude a modifié `foo.ts`") mais rate ce que Claude fait via `bash` (mv, scripts générateurs…).

**2. `fs.watch` sur le workdir** (source de vérité) — un watcher par room détecte toute création/modif/suppression, y compris via bash. À chaque changement :
- upsert dans `attachments` (source `claude`),
- broadcast `{ type: 'file_change', action, rel_path, size, mime }`.

Le **contenu** des fichiers n'est jamais poussé en WS. Les clients reçoivent la métadonnée et récupèrent le contenu à la demande via REST (`GET /rooms/:id/files?path=…`). Aperçu inline pour images/texte/markdown, bouton download sinon.

**Upload user** : `POST /rooms/:id/upload` (multipart), écrit dans le workdir, crée l'`attachment` (source `user`), rattaché au message que le user est en train d'envoyer. Le chemin relatif est injecté dans le prompt envoyé au SDK pour que Claude puisse le lire (`[Benjamin]: (fichier joint: uploads/photo.png) …`).

## Reprise à la reconnexion

Deux états persistés distincts :
- `session_id` → pour que **Claude** reprenne son contexte interne (`resume`).
- `messages` + `events` → pour que **le front** re-render l'historique, sans dépendre du format interne de Claude Code.

À la connexion WS d'un client sur une room :
1. Le serveur envoie un snapshot : `room` (dont `status`), les `messages` + `events` ordonnés, la liste `attachments`.
2. Si `status = running` : le client est raccroché au stream du turn en cours (il reçoit la suite des events en live).

## Concurrence & verrous

- **1 turn max par room** (lock via `status`). Les messages concurrents sont mis en queue, pas exécutés en parallèle.
- **v1 = lock strict.** L'interruption d'un turn en cours (`AbortController` du SDK) est repoussée en v2.
- Un seul process serveur, état des rooms en mémoire (Map roomId → { queue, watcher, abortController }). Rechargé depuis la DB au boot.

## Permissions & sécurité

Deux humains déclenchent des `bash`/`Write` sur la machine hôte → surface de risque réelle.

- Utiliser `canUseTool(toolName, input)` du SDK.
- **v1** : `Bash` demande une confirmation manuelle (broadcast d'une demande d'approbation, un user clique "autoriser" → l'exécution reprend). `Write`/`Edit` autorisés d'office dans le workdir.
- **Jamais** `permissionMode: 'bypassPermissions'` sur une machine qui compte.
- Le `cwd` est confiné au workdir de la room. Valider que les chemins d'accès fichiers (REST) ne sortent pas du workdir (anti path-traversal).

## Contrat WebSocket

**Client → Serveur**
```
{ type: 'join',    roomId, pseudo }
{ type: 'message', roomId, pseudo, content, attachmentIds?: string[] }
{ type: 'approve', roomId, requestId, allow: boolean }   -- réponse à une demande de permission
{ type: 'rename',  roomId, title }
```

**Serveur → Client**
```
{ type: 'snapshot',    room, messages, events, attachments }
{ type: 'message',     message }                       -- nouveau message (user ou claude, final)
{ type: 'text_delta',  turnId, delta }                 -- streaming incrémental du texte assistant
{ type: 'event',       event }                         -- tool_use / tool_result
{ type: 'file_change', action, relPath, size, mime }
{ type: 'permission_request', requestId, tool, input } -- demande d'approbation bash
{ type: 'status',      status }                        -- 'idle' | 'running'
{ type: 'queued',      pseudo }                        -- un message a été mis en file
{ type: 'turn_end',    turnId }
{ type: 'error',       message }
```

## Contrat REST

```
GET    /rooms                      -- liste des rooms
POST   /rooms                      -- crée une room (+ workdir), retourne { id }
PATCH  /rooms/:id                  -- rename
DELETE /rooms/:id                  -- supprime room + workdir (confirmation front)
GET    /rooms/:id/files            -- liste des fichiers du workdir
GET    /rooms/:id/files/content?path=…   -- contenu d'un fichier (inline ou download)
POST   /rooms/:id/upload           -- upload multipart d'un fichier user
```

## Design (front)

Inspiration directe de l'interface Claude chat, ambiance sobre.

**Layout**
- Sidebar gauche : liste des rooms, bouton "Nouvelle conversation", room active surlignée. Titre éditable au double-clic.
- Zone centrale : fil de messages, scroll auto en bas.
- Barre de saisie en bas : textarea auto-resize, bouton joindre (trombone) pour upload, bouton envoyer. `Entrée` envoie, `Maj+Entrée` = nouvelle ligne.
- En haut de la zone centrale : titre de la room + petits avatars/pseudos des participants connectés (présence).

**Messages**
- Bulle par message. À gauche l'avatar/pseudo de l'auteur (chaque humain une couleur, Claude une couleur distincte). Les messages humains montrent **qui** a parlé (essentiel en multi).
- Rendu **markdown** complet côté assistant : titres, listes, tableaux, blocs de code avec coloration syntaxique + bouton copier.
- Le texte assistant s'affiche **en streaming** (token par token) via `text_delta`.

**Actions de l'agent (tool_use)**
- Affichées en ligne dans le fil comme des cartes discrètes repliables :
    - Écriture fichier → "📝 a écrit `src/foo.ts`" + diff dépliable.
    - Bash → "⚡ a exécuté `npm test`" + sortie dépliable.
    - Demande de permission bash → carte avec boutons **Autoriser / Refuser** (n'importe quel participant peut trancher).
- Un turn en cours affiche un indicateur "Claude réfléchit…" / l'action courante.

**Fichiers**
- Images uploadées ou générées : miniature inline cliquable (lightbox).
- Autres fichiers : chip avec nom + taille + icône type + bouton download.
- Un fichier créé par Claude apparaît en temps réel dans le fil quand `file_change` arrive.

**États**
- Indicateur `running` visible (barre de saisie garde la saisie possible, le message part en queue avec un badge "en attente").
- Reconnexion transparente : snapshot re-render, pas d'écran de chargement bloquant.

**Thème** : clair par défaut, palette neutre proche de Claude (fond crème/blanc cassé, accents discrets). Dark mode optionnel v2.

## Périmètre v1 vs plus tard

**v1 (à livrer)**
- Rooms multiples, workdir isolé, pseudo simple.
- Turn tour-par-tour + queue FIFO + lock strict.
- Streaming texte + events tool_use/tool_result.
- `fs.watch` + métadonnées fichiers + download/aperçu REST.
- Upload user.
- Permission bash manuelle.
- Reprise à la reconnexion.
- Design Claude-like avec markdown + code + images.

**v2 (repoussé)**
- Interruption d'un turn en cours.
- Dark mode.
- Présence temps réel fine (typing indicators).
- Auth réelle.
- Gestion fine des permissions (whitelist de commandes).

## Ordre de build suggéré

1. Schéma Drizzle + migrations SQLite.
2. Backend Elysia : REST rooms + WS join/snapshot (sans agent, données mockées).
3. Front : layout, sidebar, fil de messages statique branché sur le snapshot.
4. Intégration `query()` du SDK : un turn simple, streaming texte de bout en bout.
5. Events tool_use/tool_result → cartes dans le fil.
6. `fs.watch` + REST fichiers + upload.
7. Queue + lock + reprise reconnexion.
8. Permission bash manuelle.
9. Polish design (markdown, code highlight, lightbox images).