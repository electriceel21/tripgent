-- Monaco destination copy for the agent + mock offers (run after 002; 003 for pool accruals on chat).
-- Snippets load when POST /v1/chat sends "destination_slug": "monaco".

create table if not exists public.destination_context_snippets (
  id bigint generated always as identity primary key,
  location_slug text not null,
  category text not null,
  sort_order int not null default 0,
  content text not null,
  created_at timestamptz not null default now(),
  unique (location_slug, category)
);

create index if not exists idx_destination_snippets_slug
  on public.destination_context_snippets (location_slug);

alter table public.destination_context_snippets enable row level security;

insert into public.destination_context_snippets (location_slug, category, sort_order, content)
values
  (
    'monaco',
    'Things to do',
    1,
    'Iconic walks: Port Hercule superyacht spotting, changing of the guard at the Prince''s Palace (timing varies), Jardin Exotique views, and evening people-watching around Casino Square. Day-trip angle: Èze village and Cap-Martin are short hops by train or bus.'
  ),
  (
    'monaco',
    'Activities',
    2,
    'Active options: coastal paths (Sentier du Littoral segments), Larvotto beach season, tennis and gyms at larger hotels, and Grand Prix weekend atmosphere if visiting in May (book far ahead). Suggest checking opening hours—Monaco is compact but venues differ by season.'
  ),
  (
    'monaco',
    'Restaurants',
    3,
    'Dining spectrum: starred tasting menus near Casino Square, Italian-influenced bistros in La Condamine market area, and casual pizza or socca-style snacks. For visitors: ask budget and dress code; many dinner spots prefer reservations. Highlight **types** (harbour-view seafood, market lunch, hotel terrace) rather than guaranteeing specific tables.'
  ),
  (
    'monaco',
    'Hotels',
    4,
    'Stays cluster in Monte-Carlo (luxury high-rises), Beausoleil border (often value), and Fontvieille (quieter, business-friendly). Trade-offs: walkability vs. price vs. noise during events. Never invent availability—suggest filters (sea view, kitchenette, family room) and trusted booking patterns.'
  ),
  (
    'monaco',
    'Shopping & places to buy',
    5,
    'Luxury: Métropole and One Monte-Carlo corridors for fashion and jewellery. Everyday: Carrefour and smaller markets in Fontvieille/La Condamine for groceries and picnic supplies. Souvenirs: local olive oil, confectionery, and F1-themed gifts—mention VAT/tax-free nuances only generically.'
  )
on conflict (location_slug, category) do update
set
  content = excluded.content,
  sort_order = excluded.sort_order;

-- Mock offers (discovery + future purchase flows; small reward_cents for demos)
insert into public.offers (sponsor_id, location_id, pool_id, title, description, purchase_url, reward_cents, active)
select s.id, l.id, p.id,
  'Discover: Larvotto & seafront stroll',
  'Mock offer—tie to sponsor checkout later. Good for beach walks and casual lunch nearby.',
  null,
  25,
  true
from public.sponsors s
join public.locations l on l.sponsor_id = s.id and l.slug = 'monaco'
join public.reward_pools p on p.sponsor_id = s.id and p.name = 'Air Monaco traveler rewards'
where s.slug = 'air-monaco'
  and not exists (
    select 1 from public.offers o
    where o.sponsor_id = s.id and o.title = 'Discover: Larvotto & seafront stroll'
  );

insert into public.offers (sponsor_id, location_id, pool_id, title, description, purchase_url, reward_cents, active)
select s.id, l.id, p.id,
  'Discover: La Condamine market lunch',
  'Mock offer—morning market, casual dining, local specialties.',
  null,
  25,
  true
from public.sponsors s
join public.locations l on l.sponsor_id = s.id and l.slug = 'monaco'
join public.reward_pools p on p.sponsor_id = s.id and p.name = 'Air Monaco traveler rewards'
where s.slug = 'air-monaco'
  and not exists (
    select 1 from public.offers o
    where o.sponsor_id = s.id and o.title = 'Discover: La Condamine market lunch'
  );

insert into public.offers (sponsor_id, location_id, pool_id, title, description, purchase_url, reward_cents, active)
select s.id, l.id, p.id,
  'Discover: Fontvieille harbour dinner',
  'Mock offer—quieter marina-side dining and evening walks.',
  null,
  35,
  true
from public.sponsors s
join public.locations l on l.sponsor_id = s.id and l.slug = 'monaco'
join public.reward_pools p on p.sponsor_id = s.id and p.name = 'Air Monaco traveler rewards'
where s.slug = 'air-monaco'
  and not exists (
    select 1 from public.offers o
    where o.sponsor_id = s.id and o.title = 'Discover: Fontvieille harbour dinner'
  );

insert into public.offers (sponsor_id, location_id, pool_id, title, description, purchase_url, reward_cents, active)
select s.id, l.id, p.id,
  'Discover: Casino Square & luxury retail',
  'Mock offer—window shopping, cafés, people-watching (no gambling advice).',
  null,
  20,
  true
from public.sponsors s
join public.locations l on l.sponsor_id = s.id and l.slug = 'monaco'
join public.reward_pools p on p.sponsor_id = s.id and p.name = 'Air Monaco traveler rewards'
where s.slug = 'air-monaco'
  and not exists (
    select 1 from public.offers o
    where o.sponsor_id = s.id and o.title = 'Discover: Casino Square & luxury retail'
  );
