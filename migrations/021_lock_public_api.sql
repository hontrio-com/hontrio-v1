-- 021: baza de date se folosește doar de pe server, cu cheia de serviciu (createAdminClient).
-- Cheia publică (anon) și conturile Supabase Auth (authenticated) nu mai au acces direct
-- la tabele, secvențe și funcții. Login-ul folosește Supabase Auth (schema auth), deci
-- oricine cu cont putea lua un jeton și scrie direct în tabele. Politicile vechi permiteau:
-- - users: orice cont își putea schimba singur rolul în admin;
-- - notifications: oricine, chiar fără cont, citea, scria și ștergea notificările tuturor;
-- - stores, tickets, ticket_replies: conturile își scriau direct magazinele și tichetele,
--   ocolind verificările aplicației.

drop policy if exists "Users can update own profile" on public.users;
drop policy if exists "Users can view own profile" on public.users;
drop policy if exists "Service role manages notifications" on public.notifications;
drop policy if exists "Users see own notifications" on public.notifications;
drop policy if exists "Users can create stores" on public.stores;
drop policy if exists "Users can delete own stores" on public.stores;
drop policy if exists "Users can update own stores" on public.stores;
drop policy if exists "Users can view own stores" on public.stores;
drop policy if exists "Users manage own tickets" on public.tickets;
drop policy if exists "Users manage own ticket replies" on public.ticket_replies;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Ce se creează de acum înainte nu mai primește acces automat pentru anon și authenticated
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
