-- Registro de publicação de eventos do Spring Modulith 2.x (outbox entre módulos).
-- A forma é da biblioteca: schema de PostgreSQL da documentação do Modulith.
create table if not exists event_publication (
    id                     uuid                     not null,
    listener_id            text                     not null,  -- qual ouvinte deve processar
    event_type             text                     not null,  -- classe do evento
    serialized_event       text                     not null,  -- o evento em JSON
    publication_date       timestamp with time zone not null,
    completion_date        timestamp with time zone,           -- null = ainda pendente
    status                 text,                               -- 2.x: estado da publicação
    completion_attempts    int,                                -- 2.x: quantas vezes tentou
    last_resubmission_date timestamp with time zone,           -- 2.x: último reprocessamento
    primary key (id)
);

-- O Modulith busca por evento serializado e por pendentes (completion_date nula)
create index if not exists event_publication_serialized_event_hash_idx
    on event_publication using hash (serialized_event);
create index if not exists event_publication_by_completion_date_idx
    on event_publication (completion_date);