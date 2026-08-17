# Contributing

Thanks for the interest. Issues and pull requests are open.

## Setting up

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run dev
```

The `claude` CLI must be on the `PATH`: without it the server starts, but no conversation
answers.

## How a change lands

`main` is protected: everything goes through a pull request, and CI has to be green
before it can merge. If you are not a collaborator, fork the repository, push your branch
there, and open the PR from your fork — that is the normal path and needs no permission
from anyone.

Open an issue first for anything structural. A small fix or an obvious bug needs no
preamble.

## Before opening a PR

```bash
bun run check      # Biome, lint and formatting
bun run typecheck
bun run test
```

CI runs exactly these three, plus the build. If `check` complains, `bun run fix` handles
whatever is auto-fixable.

## Conventions

- **Language**: everything in the repository is English — code, comments, commit messages,
  documentation, and the interface strings.
- **Comments** explain *why*, never *what*. A comment paraphrasing the next line gets
  removed; one that records a non-obvious constraint (a CLI quirk, a SQLite trap, an iOS
  behaviour) is worth keeping.
- **Shared types**: anything crossing the network lives in
  `packages/shared/src/protocol.ts`. The server and the front only talk through it.
- **Migrations**: change the Drizzle schema, then run `bun run db:generate`. Files under
  `apps/server/drizzle/` are never edited by hand.
- **Permission policy**: any change to `apps/server/src/agent/policy.ts` comes with tests
  in `policy.test.ts`. It is what separates a harmless command from a destructive one —
  it does not change without a net.
- **Commit messages**: conventional prefix, imperative, one line stating the effect, not
  the files touched.
- **README translations**: `README.md` is the source. `README_fr.md`, `README_es.md`,
  `README_de.md` and `README_zh.md` follow it. Changing a feature means updating the
  English file; updating the translations is welcome but never blocking.

## Reporting a security problem

A vulnerability does not go in a public issue: write to benjamin@benode.fr.
