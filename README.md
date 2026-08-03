# multiclaude

[![License: MIT](https://img.shields.io/badge/license-MIT-f97316)](LICENSE)
[![by Benode](https://img.shields.io/badge/by-Benode-052e16)](https://www.benode.fr)

Real-time multi-user chat on top of **Claude Code**. Several people talk to one agent in
one conversation, and the agent works in an isolated directory: streamed answers, visible
actions, created files shown as they land, and a human decision before anything sensitive
runs.

> Every conversation drives a real `claude` process on the host machine, on your own
> Claude subscription — no API key, nothing in between.

---

## What it does

**Work on one agent, together.** One conversation, one context, several people. You see
who is typing, what they are typing (on hover), where they are in the thread, and what
they have selected — highlighted in their colour, the way a shared document does it.
Click someone's badge and your view mirrors theirs.

**Stay out of each other's way.** The agent takes one turn at a time: concurrent messages
queue up, pinned above the input, editable or cancellable until they are sent. A turn can
be interrupted. And a conversation can be **forked**: same files, same inherited context,
two threads that diverge — to explore without spoiling someone else's work.

**Keep control of what runs.** Ordinary commands go through unattended; `sudo`, `pg_dump`,
`git push`, `docker`, a delete outside the working directory or a reach for secrets ask
for a click, with the reason shown. The policy is covered by tests.

**See the work.** Files the agent writes appear in the thread and in a resizable side
panel, as a tree or as a chronological list. Markdown, code and HTML are rendered, with
scrolling and selections shared between participants. A document edited while you read it
refreshes without losing your position.

**Start from a repository.** A conversation can clone a repository, which becomes its
working directory. For a private one: an access token typed at creation — used for the
clone then forgotten, the remote being reset to the credential-free URL — or an SSH URL
if the server holds the key.

---

## Getting started

### Requirements

- [Bun](https://bun.sh) 1.3+
- [Claude Code](https://claude.com/claude-code) installed and on the `PATH`
- `git`, to clone a repository into a conversation

### Locally

```bash
git clone https://github.com/benode-SAS/multiclaude.git
cd multiclaude
cp .env.example .env
bun install
bun run db:migrate
bun run dev
```

The interface listens on `http://localhost:3000`, the API on `8000`.

On first launch the app asks you to **create the admin account** — it is simply the first
account created, whatever the signup setting says.

One thing is left: connecting Claude Code. The key button in the sidebar opens an
authorisation link, and you paste back the code it returns. No terminal needed.

### In production

```bash
cp .env.example .env    # set at least PORT, DATA_DIR and PUBLIC_URL
bun run deploy          # install + build + migrations
bun run start
```

`SERVE_WEB` is on by default, so the server also serves the interface: **one port**, no
CORS, WebSocket on the same origin.

### Docker

```bash
docker build -t multiclaude .
docker run -p 8000:8000 -v multiclaude-data:/data \
  -e PUBLIC_URL=https://multiclaude.example.com \
  -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD='a-solid-password' \
  multiclaude
```

All the state — SQLite database, working directories, Claude credentials — lives in
`/data`. That is the only volume worth backing up.

On Railway, Fly or similar: point the service at this `Dockerfile`, attach a persistent
volume on `/data`, and set `PUBLIC_URL`. Without a volume, every redeploy starts over.

---

## Managing accounts

The first account created is an admin. From there, ⚙ → **Users** adds someone: the app
generates a temporary password, shown once, which that person must replace at their first
sign-in. The key button next to an account regenerates it — same rule afterwards.

This works whatever the signup setting says: `SIGNUP_ENABLED` only governs the public
form.

The same operations exist on the command line, which is what you need when nobody can
sign in any more:

```bash
bun run cli users list
bun run cli users add alice@example.com "Alice Martin" --admin
bun run cli users password alice@example.com    # regenerate the password
bun run cli users role alice@example.com member
bun run cli users remove alice@example.com
```

The CLI enforces the same guards as the interface: it refuses to remove the last admin,
and it runs pending migrations if the database is behind.

---

## Configuration

Everything is set in a `.env` at the root; `.env.example` documents every variable. The
ones that shape a deployment:

| Variable | What it does |
| --- | --- |
| `PORT` | Port for the API and the interface |
| `PUBLIC_URL` | Public URL — session cookies depend on it |
| `DATA_DIR` | Database, working directories, credentials. The one directory to back up |
| `SIGNUP_ENABLED` | The public signup form. An admin can create accounts either way |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Creates the admin at boot, unattended |
| `CLAUDE_CONFIG_DIR` | Where the CLI keeps its credentials. Pointing it inside `DATA_DIR` makes a deployment self-contained |
| `ALWAYS_ASK_TOOLS` | Tools that always ask for confirmation. `Bash` locks everything down |
| `ASK_PATTERNS` | Extra patterns that force a confirmation, e.g. `prod,deploy\.sh` |
| `CLONE_DEPTH` | Clone depth when creating a room. `0` for the full history |
| `GIT_TOKEN` / `GIT_SSH_KEY` | Default access to private repositories, when nobody types a token |

---

## Security — read this before exposing an instance

**The agent runs code on the host machine.** That is the point of the tool, and its risk.
Three things matter:

1. **Do not run it as `root`.** Create a dedicated user. The permission policy asks before
   dangerous commands, but it works as a deny list: a destructive command nobody
   anticipated will go through. To lock it down, `ALWAYS_ASK_TOOLS=Bash` makes every
   command ask.

2. **Any account can run commands.** There is no sandbox between members: hand out
   accounts to people you trust, and close signups (`SIGNUP_ENABLED=false`) on an instance
   reachable from the internet.

3. **The HTML preview executes JavaScript**, in an opaque origin (`sandbox` without
   `allow-same-origin`): the page can reach neither the app, nor storage, nor the API. It
   can, however, make outbound requests.

---

## Architecture

Bun monorepo: `apps/server` (Elysia + WebSocket), `apps/web` (React + Vite),
`packages/shared` (the WebSocket contract and shared types).

**One room, one `claude` process**, driven over `stream-json` on stdin/stdout and kept
alive between turns so the conversation keeps its context. If it dies, it comes back with
`--resume` on the same session. Forking branches off the parent session.

**Permissions go through a `PreToolUse` hook** that calls the server and blocks until a
human clicks. That is what makes it possible to decide from the interface rather than from
a terminal.

**File changes come from rescanning the directory**, not from system events alone: the
agent writes through a temporary file then renames it, and the final name never appears in
the event.

**Room state lives in memory** — hence a single server process, never a cluster mode.

```bash
bun run dev        # server + interface in watch mode
bun run check      # lint and formatting (Biome)
bun run typecheck
bun run test
```

---

## Contributing

Issues and pull requests are welcome. Before proposing a change: `bun run check`,
`bun run typecheck` and `bun run test` must pass — that is what CI runs.

Comments in this codebase explain *why* a decision was made when it is not obvious, never
*what* the next line does. Please keep that habit.

## Origin and licence

multiclaude is built and maintained by **[Benode](https://www.benode.fr)**, and released
under the **MIT** licence — see [LICENSE](LICENSE).

MIT allows everything: private or commercial use, modification, redistribution, bundling
into a closed product, resale. It sets **one condition**: keep the copyright notice and
the licence text in copies and derived works. In other words, do what you like with it,
but do not strip the authorship.

Concretely, if you redistribute this code or a product derived from it, keep the `LICENSE`
file as is. A note along the lines of "based on multiclaude, by Benode" is appreciated
without being required.
