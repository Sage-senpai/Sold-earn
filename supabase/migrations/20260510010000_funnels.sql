-- Funnel Architect output. One row per (bounty, run); the latest run wins.
-- Stored as jsonb to keep schema flexible while the artifact shape evolves.

create table if not exists bounty_funnels (
  id              uuid primary key default gen_random_uuid(),
  bounty_id       text not null references bounties(id) on delete cascade,
  artifact        jsonb not null,
  llm_model       text,
  -- denormalised flags so vendors can quickly see what's stale.
  bounty_title_at_run text,
  bounty_desc_hash   text,
  created_at      timestamptz not null default now()
);

create index if not exists bounty_funnels_bounty_idx
  on bounty_funnels(bounty_id, created_at desc);

alter table bounty_funnels enable row level security;
create policy bounty_funnels_read on bounty_funnels for select using (true);

-- Latest funnel per bounty.
create or replace view bounty_latest_funnel as
  select distinct on (bounty_id)
    bounty_id, artifact, llm_model, bounty_title_at_run, bounty_desc_hash, created_at
  from bounty_funnels
  order by bounty_id, created_at desc;
