# Staging Release Checklist

Este documento fecha o passo operacional antes de publicar a nova versao do CIMA.

## Objetivo

Garantir que staging use o novo modelo de carteira coletiva com ledger auditavel por cliente, sem tocar a base atual de producao antes da validacao.

## Pre-requisitos

- Banco Postgres isolado para staging
- Variaveis de ambiente preenchidas a partir de `server/.env.staging.example`
- Credenciais de admin e cliente conhecidas para o smoke check

## Ordem de execucao

1. Gerar backup da base de staging antes de qualquer migration.
2. Configurar `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` e `CLIENT_ORIGIN`.
   `CLIENT_ORIGIN` pode listar mais de um dominio separado por virgula durante o corte.
3. Confirmar que o servico esta apontando para o banco de staging correto.
4. Conferir a ordem de migrations esperada:
   - `20260331_initial_schema`
   - `20260401_collective_wallet`
   - `20260401_operation_allocations`
5. Se a base ja existia antes das migrations versionadas, marcar a inicial como aplicada:
   - `npm --prefix server run prisma:baseline:initial`
6. Aplicar migrations:
   - `npm --prefix server run prisma:deploy:smart`
7. Gerar Prisma Client:
   - `npm --prefix server run prisma:generate`
8. Reconstruir ledger historico:
   - `npm --prefix server run ledger:rebuild`
9. Se staging estiver vazio e a equipe quiser dados de exemplo:
   - `npm --prefix server run seed`
10. Executar smoke check:
   - `npm --prefix server run smoke:api`
11. Validar manualmente o frontend.
    Para testar localmente contra a API de staging/local:
    `http://127.0.0.1:8095/index.html?apiBase=http://127.0.0.1:4090/api/v1`

## Validacao manual minima

### Admin

1. Login como admin.
2. Abrir lista de clientes e confirmar saldo carregado.
3. Abrir lista de operacoes e confirmar colunas do modelo novo.
4. Criar uma operacao coletiva de teste em staging.
5. Liquidar a operacao como `WON`, `LOST` e `VOID` em cenarios controlados.
6. Conferir se o ledger da operacao existe em `/api/v1/operations/:id/allocations`.

### Cliente

1. Login como cliente.
2. Conferir aporte inicial, saldo atual e rentabilidade.
3. Conferir ultimas 5 entradas.
4. Conferir card de ultimos 6 meses.
5. Confirmar que os valores batem com o ledger da operacao.

## Criterios de saida de staging

Staging so pode ser promovido quando todos os pontos abaixo estiverem verdadeiros:

- `GET /api/v1/health` responde `status: ok`
- login admin funciona
- login cliente funciona
- `/api/v1/clients` responde sem erro
- `/api/v1/operations` responde sem erro
- `/api/v1/operations/:id/allocations` responde com lista coerente
- `/api/v1/clients/me/summary` responde com saldo e historico coerentes
- `ledger:rebuild` conclui sem erro
- nenhuma credencial sensivel esta versionada no repo

## Checklist de seguranca antes de producao

- Rotacionar todos os segredos que ja apareceram no historico do projeto
- Confirmar backup automatico do Postgres
- Confirmar restore testado em ambiente separado
- Confirmar que `JWT_SECRET` e `JWT_REFRESH_SECRET` sao diferentes
- Confirmar `CLIENT_ORIGIN` apontando para a URL oficial do frontend
- Confirmar que o deploy da API usa schema migrado

## Comandos uteis

```bash
npm --prefix server run prisma:generate
npm --prefix server run prisma:baseline:initial
npm --prefix server run prisma:deploy:smart
npm --prefix server run ledger:rebuild
npm --prefix server run smoke:api
```
