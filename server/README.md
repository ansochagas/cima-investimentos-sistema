# CIMA Backend (v1.1)

Objetivo: disponibilizar o sistema online com autenticação segura, dados persistidos em banco, cálculo preciso e áreas logadas para admin e clientes.

## Stack

- Node.js 18+
- Express
- Prisma ORM
- Banco: PostgreSQL (produção) / SQLite (dev local rápido)
- JWT (access + refresh), bcrypt
- CORS, Helmet, Rate limiting

## Como rodar (dev, SQLite)

1. Copie `.env.example` para `.env` e ajuste se necessário.
2. Instale dependências:
   - `npm install`
3. Gere Prisma e migre:
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`
4. Inicie API:
   - `npm run dev`
5. API em: `http://localhost:4000/api/v1`

## Como rodar (prod, Postgres)

1. Provisione um Postgres (Neon/Render/Railway/RDS) e preencha as variáveis em `.env`:
   - `DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?connection_limit=5"`
2. Rode migrações: `npx prisma migrate deploy`
3. Start: `npm run start`

## Rotas (resumo)

- `POST /api/v1/auth/login` — admin/cliente; retorna tokens
- `POST /api/v1/auth/refresh` — renova access token
- `POST /api/v1/auth/logout` — invalida sessão
- `GET /api/v1/health` — status
- `GET /api/v1/clients` — [admin] lista clientes
- `POST /api/v1/clients` — [admin] cria cliente (inclui `startDate`)
- `GET /api/v1/clients/:id` — [admin|self]
- `GET /api/v1/operations` — [admin] lista operações
- `POST /api/v1/operations` — [admin] cria operação diária (resultado %)
- `POST /api/v1/import` — [admin] importa CSV/XLSX (server-side)

> Notas: Implementação inicial contém stubs para importação; ajuste fino virá em iterações seguintes.

## Segurança

- JWT assinado (HS256), refresh tokens persistidos
- Hash de senhas com bcrypt
- Helmet + Rate limiting em rotas sensíveis
- CORS estrito

## Cálculo

- Operações diárias em % aplicadas sobre a carteira elegível à data
- Para cliente, saldo evolui desde `startDate`
- Campos monetários como Decimal em banco; arredondamento controlado no servidor

## Integração com o Front

- `js/api.js` centraliza chamadas. O front atual ainda usa localStorage; a migração para API será feita por etapas, trocando leituras/gravações para chamadas HTTP.


## Atualiza��es recentes

- Novas rotas para o cliente autenticado:
  - GET /api/v1/clients/me � dados do cliente com saldo recalculado
  - GET /api/v1/clients/me/summary?last=10 � resumo com �ltimas opera��es e impacto
- GET /api/v1/clients (admin) passa a retornar tamb�m `currentBalanceComputed` (saldo recalculado no servidor).
- Seguran�a m�nima adicionada:
  - Rate limiting global e em /auth/login (configur�vel por env)
  - Integra��o opcional com Sentry via SENTRY_DSN
  - Valida��o de for�a de senha no servidor ao criar cliente

### Vari�veis de ambiente �teis
- CLIENT_ORIGIN
- SENTRY_DSN (opcional), SENTRY_TRACES_SAMPLE_RATE
- RATE_LIMIT_MAX, RATE_LIMIT_LOGIN_MAX
