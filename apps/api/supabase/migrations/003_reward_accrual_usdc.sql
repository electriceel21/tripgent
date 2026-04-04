-- USDC-precise pool balances + reward accrual ledger (sub-cent rates).
-- Run after 002_air_monaco_mock.sql.

alter table public.reward_pools
  add column if not exists budget_usdc numeric(24, 12);

alter table public.reward_pools
  add column if not exists spent_usdc numeric(24, 12) not null default 0;

update public.reward_pools
set budget_usdc = (budget_cents::numeric / 100.0)
where budget_usdc is null;

update public.reward_pools
set spent_usdc = (spent_cents::numeric / 100.0)
where spent_cents is not null and spent_cents > 0 and spent_usdc = 0;

-- Air Monaco mock pool: exactly 20 USDC cap (matches product copy)
update public.reward_pools p
set
  budget_usdc = 20,
  budget_cents = 2000
from public.sponsors s
where p.sponsor_id = s.id
  and s.slug = 'air-monaco'
  and p.name = 'Air Monaco traveler rewards';

create table if not exists public.reward_accruals (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  sponsor_id bigint not null references public.sponsors (id) on delete cascade,
  pool_id bigint not null references public.reward_pools (id) on delete cascade,
  tier text not null,
  units numeric(24, 12) not null default 1,
  rate_usdc numeric(24, 12) not null,
  amount_usdc numeric(24, 12) not null,
  reason text default 'tier_rate',
  created_at timestamptz not null default now()
);

create index if not exists idx_reward_accruals_user on public.reward_accruals (user_id);
create index if not exists idx_reward_accruals_sponsor on public.reward_accruals (sponsor_id);

alter table public.reward_accruals enable row level security;
