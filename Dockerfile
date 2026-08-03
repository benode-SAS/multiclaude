# syntax=docker/dockerfile:1

# ─── Build ────────────────────────────────────────────────────────────────────
FROM oven/bun:1.3-debian AS build
WORKDIR /app

# Manifests first: the dependency layer is reused as long as they do not
# change, which avoids reinstalling on every code edit.
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

COPY . .
RUN bun run --filter @multiclaude/web build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM oven/bun:1.3-debian
WORKDIR /app

# git: cloning a repository when a room is created.
# ca-certificates: the agent's HTTPS calls and the OAuth login.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# The Claude Code CLI is the central dependency: without it no room runs at
# all. Installed globally so it resolves through the PATH.
RUN bun install -g @anthropic-ai/claude-code \
 && ln -sf /root/.bun/bin/claude /usr/local/bin/claude

COPY --from=build /app /app

ENV NODE_ENV=production \
    PORT=8000 \
    SERVE_WEB=true \
    DATA_DIR=/data \
    CLAUDE_CONFIG_DIR=/data/claude

# All the state lives here: SQLite database, the rooms' working directories
# and the CLI credentials. This is the only volume worth keeping.
VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations run before the server: a fresh volume must produce a usable
# database without a manual command.
CMD ["sh", "-c", "bun apps/server/src/db/migrate.ts && bun apps/server/src/index.ts"]
