-- sold-earn — initial server-side schema.
--
-- The client app keeps a localStorage cache for instant UI; this schema is
-- the source of truth that agents read/write. Tables mirror src/lib/types.ts.
-- IDs are generated client-side (e.g. "sale_xxx") to keep client + server
-- in sync without a roundtrip on creation.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- Profiles
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists vendors (
  address          text primary key,
  brand_name       text not null,
  bio              text not null default '',
  website          text,
  contact_x        text,
  contact_telegram text,
  created_at       timestamptz not null default now()
);

create table if not exists scouts (
  address          text primary key,
  display_name     text not null,
  bio              text not null default '',
  social_x         text,
  social_telegram  text,
  region           text not null default 'Global',
  wallet_provider  text not null,
  payout_locked    boolean not null default false,
  sbt_mint         text not null,
  reputation       int  not null default 50,
  total_earned     numeric not null default 0,
  created_at       timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Bounties / applications / sales
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists bounties (
  id                text primary key,
  vendor_address    text not null references vendors(address) on delete cascade,
  title             text not null,
  description       text not null,
  product_kind      text not null check (product_kind in ('digital','service','physical')),
  product_name      text not null,
  reward_amount     numeric not null check (reward_amount > 0),
  reward_token      text not null check (reward_token in ('USDC','SOL')),
  escrow_deposited  numeric not null default 0,
  target_sales      int    not null check (target_sales > 0),
  region            text not null default 'Global',
  status            text not null default 'active' check (status in ('draft','active','paused','completed')),
  created_at        timestamptz not null default now()
);

create table if not exists applications (
  id              text primary key,
  bounty_id       text not null references bounties(id) on delete cascade,
  bounty_title    text not null,
  scout_address   text not null,
  sbt_mint        text not null,
  sales_id        text not null unique,
  status          text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at      timestamptz not null default now()
);

create index if not exists applications_scout_idx on applications(scout_address);
create index if not exists applications_bounty_idx on applications(bounty_id);

create table if not exists sales (
  id              text primary key,
  sales_id        text not null,
  bounty_id       text not null references bounties(id) on delete cascade,
  bounty_title    text not null,
  scout_address   text not null,
  sbt_mint        text not null,
  buyer_note      text not null default '',
  tx_hash         text not null,
  payout_amount   numeric not null,
  status          text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at      timestamptz not null default now()
);

create index if not exists sales_bounty_idx on sales(bounty_id);
create index if not exists sales_scout_idx on sales(scout_address);
create index if not exists sales_tx_idx on sales(tx_hash);
create index if not exists sales_status_idx on sales(status);

-- ─────────────────────────────────────────────────────────────────────────
-- Verifier agent suggestions — one row per (sale, run). Latest run wins.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists sale_verifications (
  id              uuid primary key default gen_random_uuid(),
  sale_id         text not null references sales(id) on delete cascade,
  decision        text not null check (decision in ('auto_approve','auto_reject','human_review')),
  confidence      numeric not null check (confidence between 0 and 1),
  signals         jsonb not null default '[]'::jsonb,
  llm_reasoning   text,
  llm_model       text,
  policy_caps     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists sale_verifications_sale_idx
  on sale_verifications(sale_id, created_at desc);

-- Convenience view: every sale joined with its latest verification suggestion.
create or replace view sales_with_suggestion as
  select
    s.*,
    sv.decision      as agent_decision,
    sv.confidence    as agent_confidence,
    sv.signals       as agent_signals,
    sv.llm_reasoning as agent_reasoning,
    sv.created_at    as agent_run_at
  from sales s
  left join lateral (
    select * from sale_verifications v
    where v.sale_id = s.id
    order by v.created_at desc
    limit 1
  ) sv on true;

-- ─────────────────────────────────────────────────────────────────────────
-- Audit log — every agent action emits a row. Read-only from app.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists agent_actions (
  id            uuid primary key default gen_random_uuid(),
  agent         text not null,            -- 'sale_verifier' | 'bounty_drafter' | ...
  action        text not null,            -- 'verify_sale' | 'release_escrow' | ...
  subject_kind  text not null,            -- 'sale' | 'bounty' | 'application'
  subject_id    text not null,
  outcome       text not null,            -- 'ok' | 'denied_by_policy' | 'error'
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists agent_actions_subject_idx
  on agent_actions(subject_kind, subject_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — the service role bypasses RLS; anon/authenticated read public data
-- only. Mutations always go through our API routes.
-- ─────────────────────────────────────────────────────────────────────────

alter table vendors             enable row level security;
alter table scouts              enable row level security;
alter table bounties            enable row level security;
alter table applications        enable row level security;
alter table sales               enable row level security;
alter table sale_verifications  enable row level security;
alter table agent_actions       enable row level security;

create policy bounties_read   on bounties           for select using (true);
create policy vendors_read    on vendors            for select using (true);
create policy scouts_read     on scouts             for select using (true);
create policy applications_r  on applications       for select using (true);
create policy sales_read      on sales              for select using (true);
create policy verifs_read     on sale_verifications for select using (true);
-- agent_actions intentionally has no read policy: only service role.
