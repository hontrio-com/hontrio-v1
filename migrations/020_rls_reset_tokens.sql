-- 020: închide tabelele și funcțiile rămase deschise pentru cheia publică (anon).
-- Supabase le semnala ca „RLS disabled in public” și „SECURITY DEFINER executabil de anon”.
--
-- password_reset_tokens: aplicația o citește și o scrie doar cu cheia de serviciu
-- (createAdminClient în /api/auth/forgot-password și /api/auth/reset-password), care trece
-- peste RLS. Fără politici, anon și authenticated nu mai pot citi, adăuga sau șterge rânduri.
-- Înainte, oricine avea cheia publică putea adăuga un jeton pentru orice cont.
alter table public.password_reset_tokens enable row level security;

-- Tabele rămase de la versiunea veche (Risk Shield), nefolosite de cod.
alter table public.risk_global_blacklist enable row level security;
alter table public.risk_identity_candidates enable row level security;

-- Funcțiile vechi pentru credite, nefolosite de cod, puteau fi apelate fără cont
-- (de exemplu refund_credits adăuga credite oricărui cont).
revoke execute on function public.deduct_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.increment_bulk_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.increment_job_counter(uuid, text) from public, anon, authenticated;
revoke execute on function public.increment_template_usage(uuid, uuid) from public, anon, authenticated;
