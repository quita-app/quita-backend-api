---
name: spring-rules
description: Convenções de Java e Spring Boot do quita-backend-api (módulos, hexagonal, JPA, transações, segurança, dinheiro, testes). Use ao escrever, revisar ou discutir código Java deste repo.
---

# Regras da stack: Spring Boot

Valem para todo código do `quita-backend-api`. A origem de cada regra é o LLD da API (`../quita-docs/docs/lld/api.md`) e os ADRs; quando divergir, vale o LLD.

## Módulos e camadas

- Um pacote de primeiro nível por módulo. Nada fora do módulo importa `internal`.
- Dependências para dentro: `adapter → application → domain`. O domínio não importa `org.springframework.web`, adapters nem outro módulo.
- Entre módulos: `<Module>Api` para consultar, evento para reagir. Sem ciclo; quando dois módulos conversam nos dois sentidos, um sentido é evento.
- Porta de saída é interface no núcleo, na linguagem do módulo; não vaza tipo de infraestrutura (`Page`, `Specification`, entidade de outro módulo).
- Um caso de uso = uma classe com um método `execute` e um `Command` de entrada. Controller, listener e job são finos: traduzem e delegam.

## Domínio

- Agregado sem setters: fábrica estática e métodos de comportamento que guardam as invariantes. Transição de estado só por método do agregado.
- Value Object (`record`) para o que tem regra ou formato: `Money`, `Rate`, `Document`. Valida na construção, é imutável.
- Serviço de domínio é puro e sem anotação do Spring; é registrado por `@Bean`.
- Coleção exposta é cópia imutável (`List.copyOf`).
- Evento de domínio é `record` imutável com `tenantId`, id do agregado, instante e só o que o ouvinte precisa.

## Lombok, records e mapeamento

| Onde | Usar | Evitar |
| --- | --- | --- |
| Entidade JPA | `@Getter`, `@NoArgsConstructor(access = PROTECTED)` | `@Data`, `@Setter`, `@Builder`, `@EqualsAndHashCode`, `@ToString` sem exclusões |
| Serviço, caso de uso, controller, adapter | `@RequiredArgsConstructor` com campos `final`, `@Slf4j` | `@Autowired` em campo |
| DTO de entrada e saída, evento, command | `record` | Lombok |
| Entidade ↔ DTO | MapStruct (`componentModel = "spring"`) | Mapear à mão em controller; devolver entidade no JSON |

## Persistência

- `@Table(schema = "<module>")`; nomes em `snake_case`, tabela no singular.
- Id `UUID` v7 gerado pela aplicação. `@TenantId` em toda entidade de Credora.
- Relações `LAZY`. Carga planejada por caso de uso (`join fetch`, `@EntityGraph`, projeção em `record`). Sem N+1.
- `@Enumerated(EnumType.STRING)`.
- `equals`/`hashCode` de entidade por id, escritos à mão.
- `@Version` nos agregados que sofrem concorrência.
- `open-in-view` desligado; nada toca proxy fora da transação.
- Consulta nativa só quando o JPA não resolve, sempre parametrizada e com `tenant_id` explícito.
- Paginação por cursor nas listagens que crescem; `offset` só em lista administrativa pequena.

## Transações

- `@Transactional` no caso de uso, nunca no controller. Leitura com `readOnly = true`.
- Sem chamada HTTP externa dentro de transação.
- Atenção ao proxy: método anotado chamado pela própria classe não é interceptado. Para transação por lote, `TransactionTemplate`.
- Corrida se resolve com restrição do banco (único, único parcial) + tradução da violação para erro de negócio. `if (exists) save` não protege.

## Web

- Rotas em `/api/v1`, recursos no plural em kebab-case. Rotas do Devedor em `/api/v1/debtor/**`.
- Status corretos: 201 na criação, 202 no assíncrono, 204 sem corpo, 409 em conflito, 422 em regra violada.
- Erro sempre em Problem Details com `code` em `UPPER_SNAKE_CASE`. Nunca a mensagem da exceção inesperada na resposta.
- Entrada validada com Bean Validation no `record`. Identidade (usuário, Devedor, tenant) vem do token, nunca do corpo.
- Dinheiro e taxa como string decimal; datas ISO.
- `Idempotency-Key` obrigatório em criação com efeito (Acordo, importação).

## Segurança

- Autorização por papel com `@PreAuthorize`; por dado, na consulta (tenant e dono). Recurso de outro tenant ou de outro dono: 404.
- Token, código e convite guardados só como hash. Comparação de segredo em tempo constante.
- Resposta que não revela existência (pedido de código, login).
- Nada de segredo em arquivo versionado. Nada sensível em log.

## Eventos e jobs

- Ouvinte com `@ApplicationModuleListener`; define o tenant a partir do evento e é idempotente (pode rodar de novo).
- Job é adapter fino (`@Scheduled` com `zone = "America/Sao_Paulo"`) que chama um caso de uso; percorre os tenants um a um, uma transação por item.
- Data de negócio com `LocalDate.now(clock)`; `Clock` sempre injetado.

## Testes

- Domínio: JUnit + AssertJ, sem Spring. Os exemplos numéricos do LLD são casos obrigatórios.
- Caso de uso: Mockito nas portas, domínio real.
- Persistência e rotas: Testcontainers com PostgreSQL de verdade (nunca H2).
- Fronteiras: `ApplicationModules.verify()` e ArchUnit ficam sempre verdes.
- Sem `Thread.sleep`; tempo com `Clock` fixo, espera assíncrona com Awaitility.
- Nome do teste descreve o comportamento, em inglês.
