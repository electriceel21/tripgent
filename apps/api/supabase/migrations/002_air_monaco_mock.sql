-- Mock sponsor: Air Monaco — $20 USDC reward pool + per-tier distribution rates (USDC per reward unit).
-- Run after 001_tripgent.sql in Supabase SQL Editor.

create table if not exists public.sponsor_tier_rates (
  id bigint generated always as identity primary key,
  sponsor_id bigint not null references public.sponsors (id) on delete cascade,
  tier text not null,
  rate_usdc numeric(24, 12) not null,
  created_at timestamptz not null default now(),
  unique (sponsor_id, tier)
);

alter table public.sponsor_tier_rates enable row level security;

-- Sponsor
insert into public.sponsors (name, slug, website)
values ('Air Monaco', 'air-monaco', 'https://www.airmonaco.example')
on conflict (slug) do update
set name = excluded.name,
    website = excluded.website;

-- Home base location (optional context for campaigns)
insert into public.locations (sponsor_id, name, slug, country)
select s.id, 'Monaco', 'monaco', 'MC'
from public.sponsors s
where s.slug = 'air-monaco'
  and not exists (
    select 1
    from public.locations l
    where l.sponsor_id = s.id and l.slug = 'monaco'
  );

-- Pool: 20 USDC total budget (stored as cents: 20 * 100 = 2000)
insert into public.reward_pools (sponsor_id, location_id, name, budget_cents, spent_cents, active)
select s.id, l.id, 'Air Monaco traveler rewards', 2000, 0, true
from public.sponsors s
left join public.locations l on l.sponsor_id = s.id and l.slug = 'monaco'
where s.slug = 'air-monaco'
  and not exists (
    select 1
    from public.reward_pools p
    where p.sponsor_id = s.id
      and p.name = 'Air Monaco traveler rewards'
  );

-- Per-tier rates (USDC per distribution unit — wire your agent/payout logic to this table)
-- Tier 1 (bronze): 0.001 | Tier 2 (silver): 0.005 | Tier 3 (gold): 0.001 | Highest (platinum): 0.001
insert into public.sponsor_tier_rates (sponsor_id, tier, rate_usdc)
select s.id, v.tier, v.rate::numeric
from public.sponsors s
cross join (
  values
    ('bronze', 0.001),
    ('silver', 0.005),
    ('gold', 0.001),
    ('platinum', 0.001)
) as v(tier, rate)
where s.slug = 'air-monaco'
on conflict (sponsor_id, tier) do update
set rate_usdc = excluded.rate_usdc;
