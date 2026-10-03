# Orbis Agent Studio

AI agents with a 3D character body. "Orbis" is a working name, kept in one constant (`APP_NAME` in `packages/shared/src/config.ts`).

- `CLAUDE.md`: the production build brief (stack, features, phases).
- `PHASE-1-NOTES.md`: what is built so far, how it was verified, and what is still placeholder.
- `prototype/`: the approved HTML prototype. Read-only reference.

## Layout

```
apps/web               Next.js 14 app (landing, studio, discover, embed)
packages/characters    3D character engine (three.js r128), framework-agnostic
packages/shared        Config, characters, skills, zod schemas
prisma/schema.prisma   Draft data model (phase 2)
scripts/               Visual parity check against the prototype
```

## Develop

Requires Node 20+ and pnpm 10.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm check      # typecheck + lint + tests
```
