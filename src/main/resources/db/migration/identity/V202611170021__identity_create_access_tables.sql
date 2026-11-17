-- A Credora: o id dela é o tenant de todo o resto. Tabela global (sem tenant_id).
create table identity.creditor (
    id          uuid        primary key,              -- UUID v7, gerado pela aplicação (sem default)
    legal_name  text        not null,                 -- razão social
    document    text        not null,                 -- CNPJ, só dígitos
    slug        text        not null,                 -- vai na URL do portal: /c/escola-horizonte
    kind        text        not null,                 -- segmento: escolhe a correção padrão
    status      text        not null,
    created_at  timestamptz not null,
    updated_at  timestamptz not null,
    constraint uq_creditor_slug     unique (slug),
    constraint uq_creditor_document unique (document),
    constraint ck_creditor_document check (document ~ '^[0-9]{14}$'),
    constraint ck_creditor_kind     check (kind in ('school', 'clinic', 'gym', 'retail', 'saas', 'cooperative', 'other')),
    constraint ck_creditor_status   check (status in ('active', 'suspended'))
);

-- Usuário do backoffice: sempre de uma Credora (o admin é da Credora interna "Quita").
create table identity.app_user (
    id            uuid        primary key,
    tenant_id     uuid        not null,
    email         text        not null,
    name          text        not null,
    password_hash text        not null,                 -- Argon2id; nunca a senha
    role          text        not null,
    status        text        not null,
    last_login_at timestamptz,                          -- nulo: nunca entrou
    created_at    timestamptz not null,
    updated_at    timestamptz not null,
    constraint fk_app_user_tenant foreign key (tenant_id) references identity.creditor (id),
    constraint ck_app_user_role   check (role in ('platform_admin', 'manager', 'operator')),
    constraint ck_app_user_status check (status in ('active', 'disabled'))
);
-- Único em toda a tabela, ignorando maiúsculas: Ana@x.com e ana@x.com são o mesmo usuário
create unique index uq_app_user_email on identity.app_user (lower(email));

-- Sessão: cada linha é um refresh token. Só o hash é guardado.
create table identity.refresh_token (
    id              uuid        primary key,
    tenant_id       uuid        not null,
    subject_type    text        not null,
    subject_id      uuid        not null,               -- sem FK: na F07 guarda Devedores (outro schema)
    token_hash      text        not null,               -- sha256 do token; nunca o token
    family_id       uuid        not null,               -- todos os refresh de um mesmo login
    expires_at      timestamptz not null,
    revoked_at      timestamptz,                        -- nulo: sessão aberta
    replaced_by_id  uuid,                               -- nulo: ainda não foi usado
    created_at      timestamptz not null,
    updated_at      timestamptz not null,
    constraint fk_refresh_token_tenant      foreign key (tenant_id)      references identity.creditor (id),
    constraint fk_refresh_token_replaced_by foreign key (replaced_by_id) references identity.refresh_token (id),
    constraint ck_refresh_token_subject_type check (subject_type in ('user', 'debtor'))
);
create unique index uq_refresh_token_token_hash           on identity.refresh_token (token_hash);
create index        ix_refresh_token_tenant_id_family_id  on identity.refresh_token (tenant_id, family_id);
create index        ix_refresh_token_tenant_id_subject_id on identity.refresh_token (tenant_id, subject_id);

-- Pedido de troca de senha. Sem tenant_id: o pedido chega só com o e-mail.
create table identity.password_reset (
    id          uuid        primary key,
    user_id     uuid        not null,
    token_hash  text        not null,                   -- sha256 do link; nunca o link
    expires_at  timestamptz not null,
    used_at     timestamptz,                            -- nulo: link ainda não usado
    created_at  timestamptz not null,
    updated_at  timestamptz not null,
    constraint fk_password_reset_user foreign key (user_id) references identity.app_user (id)
);
create unique index uq_password_reset_token_hash on identity.password_reset (token_hash);
