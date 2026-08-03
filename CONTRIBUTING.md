# Contribuer

Merci de l'intérêt. Les issues et les pull requests sont ouvertes.

## Mettre en place

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run dev
```

Il faut le CLI `claude` dans le `PATH` : sans lui le serveur démarre, mais aucune
conversation ne répond.

## Avant d'ouvrir une PR

```bash
bun run check      # Biome, lint et formatage
bun run typecheck
bun run test
```

La CI lance exactement ces trois commandes, plus le build. Si `check` râle,
`bun run fix` corrige ce qui est corrigeable automatiquement.

## Conventions

- **Commentaires** : ils expliquent *pourquoi*, jamais *quoi*. Un commentaire qui
  paraphrase la ligne suivante sera retiré ; celui qui documente une contrainte non
  évidente (un contournement du CLI, un piège de SQLite, un comportement iOS) est
  précieux — gardez-le.
- **Types partagés** : tout ce qui traverse le réseau vit dans
  `packages/shared/src/protocol.ts`. Le serveur et le front ne se parlent que par là.
- **Migrations** : modifiez le schéma Drizzle puis `bun run db:generate`. Les fichiers
  de `apps/server/drizzle/` ne se retouchent pas à la main.
- **Politique de permissions** : toute évolution de `apps/server/src/agent/policy.ts`
  s'accompagne de tests dans `policy.test.ts`. C'est ce qui sépare une commande anodine
  d'une commande destructrice — ça ne se modifie pas sans filet.
- **Messages de commit** : en français, à l'impératif, une ligne qui dit l'effet
  obtenu, pas les fichiers touchés.

## Signaler un problème de sécurité

Une faille ne s'ouvre pas en issue publique : écrivez à benjamin@benode.fr.
