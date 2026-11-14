# Hontrio

Pilot automat pentru reclamele Google ale magazinelor online. Hontrio face campaniile
Google Shopping și Performance Max (doar pe feed) din produsele magazinului și le
îngrijește zilnic: scoate produsele care cheltuie fără să vândă, adaugă cuvinte negative,
oprește singur o campanie care pierde sigur bani și propune creșteri de buget, care se
aplică doar cu aprobarea omului.

Magazinele se leagă din Edinio, WooCommerce, Shopify, Gomag, MerchantPro sau OpenCart (cu
extensia Hontrio); Hontrio doar citește din magazin. Campaniile rulează în contul Google Ads
al omului, cu produsele din Merchant Center. Interfața e în română și engleză.

## Tehnologie

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- Supabase (Postgres), folosit doar de pe server, cu cheia de serviciu
- NextAuth v4: cont cu parolă sau cu Google
- Google Ads API v26 și Merchant API, prin OAuth
- Upstash Redis (limitarea cererilor), Resend (e-mailuri), Vercel (găzduire și cronuri)

## Pornire locală

```bash
npm install
cp .env.example .env.local   # completează valorile
npm run dev
```

Migrările sunt în `migrations/` și se rulează în ordine, în Supabase.

## Comenzi

- `npm run dev`, `npm run build`, `npm run start`
- `npm run lint`
- `npm test`: testele din `tests/` (planul, grupele, pilotul, auditul, Merchant Center, conectorii)
- `node scripts/build-opencart.mjs`: arhivele extensiei OpenCart din `integrations/opencart` în `public/downloads`
- `npm run i18n:check`: cheile de traducere (ro/en) și textele scrise direct în interfață

## Structura

```
app/(marketing)/     prima pagină a site-ului și paginile legale
app/(auth)/          intrarea, contul nou, parola uitată
app/(dashboard)/     platforma: Prezentare, Campanii, Rapoarte, Produse, Recomandări, Setări, Suport
app/onboarding/      primii pași: magazinul și contul Google Ads
app/admin/           administrarea: statistici, financiar, utilizatori, tichete, anunțuri, activitate, starea sistemului
app/api/             rutele API și cronurile (app/api/cron)
components/          interfața (components/app: piesele comune; components/site: site-ul)
lib/ads/             pilotul: auditul, bucla de optimizare, jurnalul
lib/campaigns/       planul campaniei principale și grupele de produse
lib/google/          Google Ads: OAuth, conturi, lansare, rapoarte
lib/merchant/        Merchant Center
lib/commerce/        modelul comun al magazinelor și motorul de sincronizare pe pagini (paged-sync);
                     conectorii: lib/edinio, lib/woocommerce, lib/shopify, lib/gomag, lib/merchantpro, lib/opencart
integrations/opencart/  extensia Hontrio pentru OpenCart 3 și 4 (PHP)
lib/i18n/            traducerile (lib/i18n/messages/{ro,en})
docs/campanii/       specificația campaniilor și a pilotului
docs/integrari/      conectorii Gomag, MerchantPro și contractul extensiei OpenCart
```

## Cronuri (vercel.json)

- `/api/cron/commerce-sync`, la 15 minute: produsele și comenzile magazinelor
- `/api/cron/ads-sync`, din oră în oră: pilotul, o trecere pe zi pe fiecare magazin
- `/api/cron/retention`, zilnic: șterge datele vechi (comenzi și metrici peste 400 de zile,
  datele din Google după 30 de zile fără legătură, conturi neconfirmate și altele)

Toate cer `Authorization: Bearer CRON_SECRET`.

## Variabile de mediu

Numele sunt în `.env.example`.
