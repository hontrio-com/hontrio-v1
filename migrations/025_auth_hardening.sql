-- 025: autentificarea întărită (auditul de securitate din 12.11.2026).
--
-- users
--   email_verified_at        adresa confirmată; un cont cu parolă nu intră până atunci
--   email_verify_token_hash  SHA-256 al jetonului din e-mailul de confirmare (jetonul nu se păstrează)
--   email_verify_expires_at  până când e bun jetonul (24 de ore)
--   session_version          crește la resetarea sau schimbarea parolei, la schimbarea rolului și
--                            când Google preia un cont neconfirmat; o sesiune (JWT) cu altă
--                            versiune nu mai e valabilă
--   terms_accepted_at        când a acceptat omul Termenii (cu DPA), Politica de confidențialitate
--   terms_version            și clauzele acceptate expres (art. 1203 C. civ.); versiunea textului
-- stores
--   next_sync_at, sync_failures  pauza crescătoare a sincronizării după eșecuri: un magazin care
--                                nu răspunde nu mai ține pe loc cronul pentru toți
-- notification_reads             cine a citit anunțurile globale (până acum aveau un singur
--                                is_read, comun tuturor)
-- bump_session_version()         creșterea atomică a versiunii sesiunii (doar cheia de serviciu)

alter table public.users add column if not exists email_verified_at       timestamptz;
alter table public.users add column if not exists email_verify_token_hash text;
alter table public.users add column if not exists email_verify_expires_at timestamptz;
alter table public.users add column if not exists session_version         integer not null default 0;
alter table public.users add column if not exists terms_accepted_at       timestamptz;
alter table public.users add column if not exists terms_version           text;

create unique index if not exists users_email_verify_token_hash_key
  on public.users (email_verify_token_hash) where email_verify_token_hash is not null;

-- Conturile reale de azi (admini, conturi cu magazin, contul demo) le considerăm confirmate.
-- Conturile false rămân neconfirmate: nu mai pot intra și le șterge curățenia zilnică.
update public.users u set email_verified_at = coalesce(u.created_at, now())
where u.email_verified_at is null
  and (u.role = 'admin' or u.email like '%.invalid' or exists (select 1 from public.stores s where s.user_id = u.id));

-- Linkul de resetare nu mai poartă adresa de e-mail: jetonul se caută după hash
create index if not exists idx_password_reset_tokens_token_hash on public.password_reset_tokens (token_hash);

alter table public.stores add column if not exists next_sync_at  timestamptz;
alter table public.stores add column if not exists sync_failures integer not null default 0;
create index if not exists idx_stores_next_sync_at on public.stores (next_sync_at);

-- Tipul cheii lui notifications se ia din tabel (cheia străină trebuie să aibă același tip)
do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.notifications'::regclass and a.attname = 'id' and not a.attisdropped;

  execute format(
    'create table if not exists public.notification_reads (
       user_id         uuid not null references public.users(id) on delete cascade,
       notification_id %s not null references public.notifications(id) on delete cascade,
       read_at         timestamptz not null default now(),
       primary key (user_id, notification_id)
     )', id_type);
end $$;

alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from anon, authenticated;
grant all on public.notification_reads to service_role;

create or replace function public.bump_session_version(p_user_id uuid)
returns integer
language sql
set search_path = ''
as $$
  update public.users set session_version = session_version + 1 where id = p_user_id returning session_version;
$$;

revoke all on function public.bump_session_version(uuid) from public, anon, authenticated;
grant execute on function public.bump_session_version(uuid) to service_role;
