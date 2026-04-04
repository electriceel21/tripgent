-- Run this in the Supabase SQL editor for the SAME project as your API's SUPABASE_URL.
-- If these counts are > 0 here but the admin dashboard shows 0, Vercel is using a different URL/key.

select
  (select count(*) from public.sponsors) as sponsors,
  (select count(*) from public.locations) as locations,
  (select count(*) from public.reward_pools) as pools,
  (select count(*) from public.offers) as offers,
  (select count(*) from public.users) as users,
  (select count(*) from public.purchases) as purchases;

-- Expect at least one row for Air Monaco after 002:
select id, slug, name from public.sponsors order by id desc limit 5;
