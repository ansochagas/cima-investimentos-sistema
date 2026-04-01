# CIMA Backend

Backend da carteira coletiva do projeto CIMA.

## Modelo oficial

- Cada operacao representa uma aposta coletiva.
- Todos os clientes elegiveis participam proporcionalmente ao saldo que tinham na data da entrada.
- O admin informa evento, mercado, odd, percentual da banca e resultado.
- O backend calcula stake, P&L, saldo e guarda o ledger por cliente.

## Stack

- Node.js 18+
- Express
- Prisma ORM
- PostgreSQL em staging/producao
- JWT + bcrypt

## Variaveis de ambiente

Use `.env.example` para dev local e `.env.staging.example` como referencia de staging.

Campos mais importantes:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CLIENT_ORIGIN`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_LOGIN_MAX`

`CLIENT_ORIGIN` aceita lista separada por virgula para fases de corte entre frontend antigo e novo.

## Scripts

- `npm run dev` - sobe a API local
- `npm run start` - sobe a API em modo normal
- `npm run seed` - popula dados basicos e reconstrui o ledger
- `npm run ledger:rebuild` - recalcula saldo e recria `OperationAllocation`
- `npm run smoke:api` - valida health, auth, clients, operations e area do cliente
- `npm run prisma:generate` - gera Prisma Client
- `npm run prisma:baseline:initial` - marca a migration inicial como aplicada em banco legado
- `npm run prisma:deploy:smart` - detecta banco legado, aplica baseline se necessario e roda deploy
- `npm run prisma:deploy` - aplica migrations pendentes

## Migrations obrigatorias atuais

Aplicar em ordem:

1. `20260331_initial_schema`
2. `20260401_collective_wallet`
3. `20260401_operation_allocations`

Depois das migrations, rodar:

```bash
npm run ledger:rebuild
```

Se a base ja existia antes das migrations versionadas, faca o baseline da inicial antes do deploy:

```bash
npm run prisma:baseline:initial
npm run prisma:deploy
```

Para deploy automatizado em hospedagem, prefira:

```bash
npm run prisma:deploy:smart
```

## Rotas principais

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/verify`
- `GET /api/v1/health`
- `GET /api/v1/clients`
- `POST /api/v1/clients`
- `GET /api/v1/clients/me`
- `GET /api/v1/clients/me/summary?last=5`
- `GET /api/v1/operations`
- `POST /api/v1/operations`
- `PATCH /api/v1/operations/:id/settle`
- `GET /api/v1/operations/:id/allocations`

## Fluxo seguro para staging

1. Provisione um Postgres isolado.
2. Configure as variaveis de ambiente do servico.
3. Se o banco ja existia, rode `npm run prisma:baseline:initial`.
4. Rode `npm run prisma:deploy`.
5. Rode `npm run ledger:rebuild`.
6. Rode `npm run smoke:api` com as variaveis `SMOKE_*` preenchidas.
7. Valide o front com login admin e cliente.

## Estado atual

- O backend ja suporta carteira coletiva.
- O ledger por cliente ja esta modelado e persistido.
- O deploy real ainda depende de aplicar as migrations em banco alinhado.
