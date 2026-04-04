-- Run in Supabase SQL Editor (or supabase db push) before starting the API.
-- API uses SUPABASE_SERVICE_ROLE_KEY server-side only (bypasses RLS).

create table if not exists public.sponsors (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  website text,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id bigint generated always as identity primary key,
  sponsor_id bigint references public.sponsors (id) on delete set null,
  name text not null,
  slug text not null,
  country text,
  created_at timestamptz not null default now(),
  unique (sponsor_id, slug)
);

create table if not exists public.reward_pools (
  id bigint generated always as identity primary key,
  sponsor_id bigint not null references public.sponsors (id) on delete cascade,
  location_id bigint references public.locations (id) on delete set null,
  name text not null,
  budget_cents bigint not null default 0,
  spent_cents bigint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id bigint generated always as identity primary key,
  sponsor_id bigint not null references public.sponsors (id) on delete cascade,
  location_id bigint references public.locations (id) on delete set null,
  pool_id bigint references public.reward_pools (id) on delete set null,
  title text not null,
  description text,
  purchase_url text,
  reward_cents bigint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  display_name text,
  reputation_score bigint not null default 0,
  tier text not null default 'bronze',
  purchases_confirmed bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  offer_id bigint not null references public.offers (id) on delete cascade,
  amount_cents bigint,
  status text not null default 'pending',
  purchased_at timestamptz not null default now(),
  notes text
);

create index if not exists idx_purchases_user on public.purchases (user_id);
create index if not exists idx_purchases_offer on public.purchases (offer_id);
create index if not exists idx_locations_sponsor on public.locations (sponsor_id);

alter table public.sponsors enable row level security;
alter table public.locations enable row level security;
alter table public.reward_pools enable row level security;
alter table public.offers enable row level security;
alter table public.users enable row level security;
alter table public.purchases enable row level security;

-- No policies: anon/authenticated cannot access. Service role bypasses RLS.
