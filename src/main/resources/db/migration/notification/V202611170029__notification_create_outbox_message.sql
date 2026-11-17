-- Caixa de saída: a mensagem é gravada aqui; a demo lê em /demo/inbox (F07). Sem envio real no MVP.
create table notification.outbox_message (
    id            uuid        primary key,
    tenant_id     uuid        not null,                 -- sem FK: creditor é de outro schema
    channel       text        not null,                 -- email, sms
    recipient     text        not null,
    template_key  text        not null,                 -- sem check: cresce a cada funcionalidade
    body          text        not null,
    status        text        not null,                 -- scheduled, sent, skipped
    scheduled_for timestamptz not null,
    sent_at       timestamptz,                          -- nulo até enviar
    skip_reason   text,                                 -- nulo, a não ser que status = skipped
    created_at    timestamptz not null,
    updated_at    timestamptz not null,
    constraint ck_outbox_message_channel check (channel in ('email', 'sms')),
    constraint ck_outbox_message_status  check (status in ('scheduled', 'sent', 'skipped'))
);
create index ix_outbox_message_tenant_id_created_at on notification.outbox_message (tenant_id, created_at);
