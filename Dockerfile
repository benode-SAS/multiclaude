# syntax=docker/dockerfile:1

# ─── Build ────────────────────────────────────────────────────────────────────
FROM oven/bun:1.3-debian AS build
WORKDIR /app

# Les manifestes d'abord : la couche de dépendances est réutilisée tant qu'ils
# ne changent pas, ce qui évite de réinstaller à chaque modification de code.
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

# git : le clonage de dépôt à la création d'une room.
# ca-certificates : les appels HTTPS de l'agent et la connexion OAuth.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Le CLI Claude Code est la dépendance centrale : sans lui, aucune room ne
# tourne. Installé globalement pour être résolu via le PATH.
RUN bun install -g @anthropic-ai/claude-code \
 && ln -sf /root/.bun/bin/claude /usr/local/bin/claude

COPY --from=build /app /app

ENV NODE_ENV=production \
    PORT=8000 \
    SERVE_WEB=true \
    DATA_DIR=/data \
    CLAUDE_CONFIG_DIR=/data/claude

# Tout l'état tient ici : base SQLite, dossiers de travail des rooms et
# identifiants du CLI. C'est le seul volume à conserver.
VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Les migrations tournent avant le serveur : un volume neuf doit produire une
# base utilisable sans commande manuelle.
CMD ["sh", "-c", "bun apps/server/src/db/migrate.ts && bun apps/server/src/index.ts"]
