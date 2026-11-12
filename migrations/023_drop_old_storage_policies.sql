-- 023: politicile de Storage ale bucket-urilor versiunii vechi. Bucket-urile product-images
-- (imaginile AI) și blog-images au fost golite și șterse pe 12.11.2026 prin API-ul de Storage.
-- „Users can upload images” lăsa orice cont Supabase să încarce fișiere în product-images.
drop policy if exists "Anyone can view product images" on storage.objects;
drop policy if exists "Public can view blog images" on storage.objects;
drop policy if exists "Users can delete own images" on storage.objects;
drop policy if exists "Users can upload images" on storage.objects;
