# AGENTS.md: quita-backend-api

API do **Quita**, uma plataforma B2B de cobrança e renegociação de dívidas. É um monólito modular em Spring Boot: todas as regras de negócio, os dados e as integrações, mais o gateway de pagamento fake. Atende o backoffice (`quita-backoffice-web`) e o portal do devedor (`quita-debtor-portal-web`).

## Onde está o contexto

Os repos do Quita ficam lado a lado na mesma pasta. A documentação é do `quita-docs` e **não é copiada para cá**.

| Preciso de | Leia |
| --- | --- |
| Vocabulário do domínio (nome em português ↔ nome em código) | `../quita-docs/GLOSSARY.md` (importado pelo `CLAUDE.md`) |
| Módulos, regras de negócio, valores, contrato, segurança | `../quita-docs/docs/lld/api.md` |
| Tabelas, convenções, índices, migrações | `../quita-docs/docs/lld/database.md` |
| Arquitetura e decisões | `../quita-docs/docs/hld.md`, `../quita-docs/docs/adr/` |
| A funcionalidade e a tarefa em andamento | `../quita-docs/docs/features/<NN>-<title>/` |

## Stack

Java 25 · Spring Boot 4.1.2 · Spring Web MVC com virtual threads · Spring Data JPA + Hibernate · Flyway · Spring Modulith · Spring Security (resource server de JWT) · PostgreSQL · Maven · JUnit 5, AssertJ, Mockito, Testcontainers.

Versões fixadas: <!-- preencher no walking skeleton: Spring Boot, Spring Modulith, PostgreSQL -->

## Comandos

| Para | Comando |
| --- | --- |
| Subir o banco local | `docker compose up -d` |
| Rodar a API (perfil local) | `./mvnw spring-boot:run -Dspring-boot.run.profiles=local` |
| Testes | `./mvnw test` |
| Build completo (testes + verificações) | `./mvnw verify` |
| Um teste só | `./mvnw test -Dtest=ClassName#methodName` |
| Gerar o `openapi.json` | <!-- preencher no walking skeleton --> |

Docker precisa estar rodando para os testes (Testcontainers).

## Estrutura

Cada pacote de primeiro nível abaixo de `com.quita` é um **módulo** do Spring Modulith. Só o pacote raiz do módulo e os pacotes de interface nomeada (`events`) são visíveis para os outros.

```
com.quita
  shared/            núcleo compartilhado, sem regra de negócio (money, tenant, web, time)
  <module>/
    <Module>Api.java   API pública do módulo para os outros módulos
    events/            eventos publicados (records)
    internal/
      domain/model     agregados e value objects
      domain/service   regras sem estado
      domain/port      portas de saída (interfaces)
      application/     casos de uso (uma classe, um execute) e commands
      adapter/in/      web, event, scheduler
      adapter/out/     persistence, clientes HTTP, outros módulos
```

Módulos: `identity`, `portfolio`, `negotiation`, `payment`, `collection`, `notification`, `analytics`, `audit`, `fakegateway`.

O banco local sobe pelo `compose.yaml` na raiz do repo (PostgreSQL na mesma versão do Neon).

Migrações em `src/main/resources/db/migration/<module>/`, com o nome `V<AAAAMMDDHHmm>__<module>_<descricao>.sql`.

## Convenções

- **Idioma:** código, nomes, comentários, commits e branches em inglês. Os nomes de domínio seguem o `GLOSSARY.md`.
- **Dependências só para dentro:** `adapter → application → domain`. O domínio não importa Spring Web, nem adapters, nem outro módulo.
- **Entre módulos:** consulta pela API pública do módulo; reação por evento. Nunca acesse o `internal` nem o schema de outro módulo.
- **Dinheiro:** sempre `Money`/`Rate` (`BigDecimal`), nunca `double`; no JSON, string decimal.
- **Tenant:** toda entidade de Credora tem `@TenantId`; consulta nativa leva o `tenant_id` à mão.
- **Erros:** exceção de domínio com `code` estável, traduzida para Problem Details. O `code` novo entra na tabela do LLD da API.
- **Migração aplicada nunca é editada.** Mudança que quebra segue expandir e contrair.
- **Segredos** só por variável de ambiente; `.env.example` versionado.
- **Logs** nunca registram senha, token, código de acesso, CPF completo nem corpo de webhook.
- **Commits** semânticos, em inglês, uma frase (`feat: add agreement state machine`). Commit, push e PR só a pedido.
- **Branches:** `main` protegida + `feat/*`, `fix/*`, `chore/*`, `docs/*`, `test/*`.

As regras detalhadas da stack estão na skill `spring-rules` (`.claude/skills/spring-rules/`).

## Antes de dar uma tarefa por pronta

1. `./mvnw verify` verde (inclui os testes de fronteira do Modulith e de arquitetura).
2. Contrato alterado? `openapi.json` regenerado e versionado.
3. Rota nova de leitura na suíte de isolamento entre tenants.
4. Regra, valor ou código de erro novo refletido no LLD do `quita-docs`.
