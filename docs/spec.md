# Spec — multi-user Claude Code chat (v1)

> Historical document: this is the original v1 specification. The build diverged from
> it on three points — the Agent SDK was replaced by the `claude` CLI driven over
> stream-json, `fs.watch` gave way to a rescan of the working directory, and accounts
> with roles replaced the free-form nickname. The README describes what actually ships.

## Goal

A web application letting several people talk **in real time, in one conversation**,
with a Claude Code agent. Each conversation ("room") drives an isolated Claude Code
process with its own workdir. Answers and actions (files, commands) stream to every
connected participant. Persistent history, resumed on reconnection.

Initial use: internal, 2–3 people. Priority: **simple and fully working**, not scalable.

## Settled decisions

- **Rooms**: several conversations, creatable on the fly.
- **Workdir**: one per room, isolated.
- **Auth**: none, just a nickname typed on entry (kept client-side, sent with every
  message).

## Stack

- **Backend**: Elysia (Bun), native WebSocket, REST for file upload/download.
- **Agent**: `@anthropic-ai/claude-agent-sdk`, one `query()` call per turn, session
  resumed through `session_id`.
- **DB**: SQLite + Drizzle. One `data/app.db` file.
- **Front**: React + Vite, TypeScript. Design inspired by the Claude chat (see the
  Design section).
- **Files**: on disk under `data/rooms/<roomId>/workdir/`. The DB only stores metadata.

## Data model (Drizzle / SQLite)

```
rooms
  id            text pk (nanoid)
  title         text            -- editable, defaults to "New conversation"
  session_id    text nullable   -- Claude Code session_id, set after the first turn
  workdir       text            -- absolute path
  status        text            -- 'idle' | 'running'
  created_at    integer
  updated_at    integer

messages
  id            text pk (nanoid)
  room_id       text fk
  author        text            -- the human's nickname, or 'claude'
  role          text            -- 'user' | 'assistant' | 'system'
  content       text            -- markdown, for display
  created_at    integer

events          -- trace of the agent's actions, to re-render (tool_use, tool_result…)
  id            text pk
  room_id       text fk
  turn_id       text            -- groups the events of one turn
  seq           integer         -- order within the turn
  type          text            -- 'tool_use' | 'tool_result' | 'file_change' | 'text'
  payload       text (json)
  created_at    integer

attachments     -- files uploaded by a user OR produced by Claude
  id            text pk
  room_id       text fk
  message_id    text fk nullable   -- attached to a message (user upload) where relevant
  source        text               -- 'user' | 'claude'
  filename      text
  rel_path      text               -- path relative to the workdir
  mime          text
  size          integer
  created_at    integer
```

## Life of a turn

The Agent SDK is **turn by turn**: only one turn can run at a time per room. That calls
for a **FIFO queue per room** plus an `idle | running` state.

1. A user sends a message (over WS).
2. If `status = running` → the message is pushed onto the room's queue and a `queued`
   event is broadcast (the others see "message waiting").
3. If `status = idle` → switch to `running` and start the turn.
4. The user message is persisted (`messages`) and broadcast to everyone immediately.
5. Call `query()` with `resume: room.session_id` (undefined on the first turn) and
   `cwd: room.workdir`.
6. Iterate over the SDK's event stream:
    - `system/init` → capture or update the `session_id`.
    - `assistant` (text) → incremental broadcast plus accumulation.
    - `assistant` (tool_use) → persist to `events`, broadcast (clients show "Claude
      writes `src/x.ts`", "Claude runs `bash …`").
    - `user` (tool_result) → persist to `events`, broadcast.
    - `result` (end of turn) → persist the final assistant message, update `session_id`,
      broadcast `turn_end`.
7. Back to `idle`, then pop the queue: if a message is waiting, start another turn.

**Author in the prompt**: every message sent to the SDK is prefixed with the nickname,
`[Benjamin]: …`, so Claude can tell who is speaking in a multi-user conversation.

## File handling

Two complementary mechanisms:

**1. Detection through events** — `tool_use` entries of type `Write`/`Edit` carry the
path and the diff. Enough to notify ("Claude edited `foo.ts`") but blind to whatever
Claude does through `bash` (mv, generator scripts…).

**2. `fs.watch` on the workdir** (source of truth) — one watcher per room catches every
creation, edit and deletion, including through bash. On each change:
- upsert into `attachments` (source `claude`),
- broadcast `{ type: 'file_change', action, rel_path, size, mime }`.

File **contents** never go over WS. Clients get the metadata and fetch the content on
demand over REST (`GET /rooms/:id/files?path=…`). Inline preview for images, text and
markdown; a download button otherwise.

**User upload**: `POST /rooms/:id/upload` (multipart), writes into the workdir, creates
the `attachment` (source `user`), attached to the message the user is composing. The
relative path is injected into the prompt sent to the SDK so Claude can read it
(`[Benjamin]: (attached file: uploads/photo.png) …`).

## Resuming on reconnection

Two distinct persisted states:
- `session_id` → so **Claude** picks its internal context back up (`resume`).
- `messages` + `events` → so **the front** can re-render the history, without depending
  on Claude Code's internal format.

When a client opens a WS connection on a room:
1. The server sends a snapshot: `room` (including `status`), the ordered `messages` and
   `events`, and the `attachments` list.
2. If `status = running`: the client is hooked onto the running turn's stream (it
   receives the following events live).

## Concurrency and locking

- **One turn per room at most** (locked through `status`). Concurrent messages queue up,
  they do not run in parallel.
- **v1 = strict lock.** Interrupting a running turn (the SDK's `AbortController`) is
  pushed to v2.
- A single server process, room state in memory (Map roomId → { queue, watcher,
  abortController }). Reloaded from the DB at boot.

## Permissions and security

Two humans triggering `bash`/`Write` on the host machine is a real risk surface.

- Use the SDK's `canUseTool(toolName, input)`.
- **v1**: `Bash` asks for manual confirmation (an approval request is broadcast, a user
  clicks "allow" → execution resumes). `Write`/`Edit` allowed outright inside the
  workdir.
- **Never** `permissionMode: 'bypassPermissions'` on a machine that matters.
- `cwd` is confined to the room's workdir. Validate that file access paths (REST) do not
  leave the workdir (path traversal).

## WebSocket contract

**Client → Server**
```
{ type: 'join',    roomId, pseudo }
{ type: 'message', roomId, pseudo, content, attachmentIds?: string[] }
{ type: 'approve', roomId, requestId, allow: boolean }   -- answer to a permission request
{ type: 'rename',  roomId, title }
```

**Server → Client**
```
{ type: 'snapshot',    room, messages, events, attachments }
{ type: 'message',     message }                       -- new message (user or claude, final)
{ type: 'text_delta',  turnId, delta }                 -- incremental assistant text
{ type: 'event',       event }                         -- tool_use / tool_result
{ type: 'file_change', action, relPath, size, mime }
{ type: 'permission_request', requestId, tool, input } -- bash approval request
{ type: 'status',      status }                        -- 'idle' | 'running'
{ type: 'queued',      pseudo }                        -- a message was queued
{ type: 'turn_end',    turnId }
{ type: 'error',       message }
```

## REST contract

```
GET    /rooms                      -- list the rooms
POST   /rooms                      -- create a room (+ workdir), returns { id }
PATCH  /rooms/:id                  -- rename
DELETE /rooms/:id                  -- delete room + workdir (confirmed on the front)
GET    /rooms/:id/files            -- list the workdir files
GET    /rooms/:id/files/content?path=…   -- a file's content (inline or download)
POST   /rooms/:id/upload           -- multipart upload of a user file
```

## Design (front)

Directly inspired by the Claude chat interface, quiet mood.

**Layout**
- Left sidebar: the room list, a "New conversation" button, active room highlighted.
  Title editable on double-click.
- Central area: the message thread, auto-scrolled to the bottom.
- Input bar at the bottom: auto-resizing textarea, attach button (paperclip) for
  uploads, send button. `Enter` sends, `Shift+Enter` inserts a line break.
- Above the central area: the room title plus small avatars/nicknames of the connected
  participants (presence).

**Messages**
- One bubble per message. The author's avatar and nickname on the left (a colour per
  human, a distinct one for Claude). Human messages show **who** spoke — essential with
  several people.
- Full **markdown** rendering on the assistant side: headings, lists, tables, code
  blocks with syntax highlighting and a copy button.
- Assistant text appears **as it streams** (token by token) through `text_delta`.

**Agent actions (tool_use)**
- Shown inline in the thread as discreet collapsible cards:
    - File write → "wrote `src/foo.ts`" plus an expandable diff.
    - Bash → "ran `npm test`" plus expandable output.
    - Bash permission request → a card with **Allow / Deny** buttons (any participant
      can decide).
- A running turn shows a "Claude is thinking…" indicator, or the current action.

**Files**
- Uploaded or generated images: clickable inline thumbnail (lightbox).
- Other files: a chip with name, size, type icon and a download button.
- A file created by Claude appears in the thread in real time when `file_change`
  arrives.

**States**
- The `running` state is visible (the input bar still accepts typing, the message goes
  to the queue with a "waiting" badge).
- Transparent reconnection: the snapshot re-renders, no blocking loading screen.

**Theme**: light by default, a neutral palette close to Claude's (cream / off-white
background, discreet accents). Dark mode optional, v2.

## v1 scope versus later

**v1 (to ship)**
- Multiple rooms, isolated workdir, simple nickname.
- Turn-by-turn execution, FIFO queue, strict lock.
- Text streaming plus tool_use/tool_result events.
- `fs.watch`, file metadata, REST download and preview.
- User upload.
- Manual bash permission.
- Resume on reconnection.
- Claude-like design with markdown, code and images.

**v2 (deferred)**
- Interrupting a running turn.
- Dark mode.
- Fine-grained real-time presence (typing indicators).
- Real authentication.
- Fine-grained permission handling (command allow list).

## Suggested build order

1. Drizzle schema plus SQLite migrations.
2. Elysia backend: REST rooms plus WS join/snapshot (no agent, mocked data).
3. Front: layout, sidebar, static message thread wired to the snapshot.
4. SDK `query()` integration: one simple turn, text streaming end to end.
5. tool_use/tool_result events → cards in the thread.
6. `fs.watch` plus REST files plus upload.
7. Queue, lock, resume on reconnection.
8. Manual bash permission.
9. Design polish (markdown, code highlighting, image lightbox).
