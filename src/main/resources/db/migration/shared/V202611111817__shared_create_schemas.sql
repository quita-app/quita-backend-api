 -- Um schema por módulo da API: cada módulo só escreve no próprio (ADR 0008)
 create schema if not exists identity;      -- Credoras, usuários, sessões, acesso do Devedor
 create schema if not exists portfolio;     -- importações, Devedores, Dívidas
 create schema if not exists negotiation;   -- Política, Proposta, Acordo, Parcelas
 create schema if not exists payment;       -- Cobranças, Pagamentos, webhooks
 create schema if not exists collection;    -- Fila, reserva, Tratativas
 create schema if not exists notification;  -- caixa de saída de mensagens
 create schema if not exists analytics;     -- modelos de leitura do Painel
 create schema if not exists audit;         -- trilha de ações (Fase 2)
 create schema if not exists fake_gateway;  -- o provedor de Pix simulado

 -- Busca por trecho de nome com índice de trigramas (usada na busca de Devedores, F05)
 create extension if not exists pg_trgm;