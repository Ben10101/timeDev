# Plataforma de EAD

Monorepo full stack gerado pela AI Software Factory.

## Estrutura

- `apps/web`: frontend React + Vite + TypeScript
- `apps/api`: backend Express + TypeScript
- `packages/shared`: contratos e tipos compartilhados
- `packages/ui`: componentes compartilhados
- `packages/config`: configurações centralizadas
- `prisma`: schema do banco

## Como começar

1. Instale dependências no monorepo
2. Configure `.env` a partir de `.env.example`
3. Rode `npm run dev:web` e `npm run dev:api`
