-- 026: atașamentele tichetelor de suport, într-un bucket privat.
--
-- Până acum stăteau în `uploads`, care e public: oricine avea adresa vedea fișierul
-- (capturi din contul Google Ads, facturi). De acum se încarcă în `ticket-attachments`,
-- privat, fără politici pe storage.objects: le citește doar serverul (cheia de serviciu),
-- care dă omului și echipei linkuri semnate, valabile o oră.
--
-- Fișierele vechi din uploads/ticket-attachments/ rămân unde sunt (o migrație nu mută
-- obiecte din Storage); aplicația le arată mai departe.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments', 'ticket-attachments', false, 4194304,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- `uploads` rămâne public doar pentru avatare: numai imagini, cel mult 2 MB
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    file_size_limit = 2097152
where id = 'uploads';
