# Campaniile Google Shopping în Hontrio — specificație

Scrisă pe 25.10.2026, după documentația oficială Google Ads API v26 (fișierele `.proto`
din `googleapis/googleapis`, exemplele `google-ads-python`), Merchant API v1 și
paginile Google Ads Help. Sursele sunt la final. Ce n-am putut verifica pe un cont
real e marcat **neverificat**.

Principii:
- **Profit, nu volum.** Orice țintă pornește de la pragul de profit al magazinului
  (`lib/ads/economics.ts`) și nu coboară niciodată sub el.
- **Nu stricăm ce e al omului.** Nu dublăm feedul și nu schimbăm conversia de
  cumpărare. Campaniile existente le atingem doar cu acordul lui explicit.
- **Ce trimitem în Merchant Center** merge într-o sursă suplimentară a noastră, legată
  ultima (cea mai mică prioritate). Nu suprascrie nimic din feedul omului.
- **Google decide licitația pe click; Hontrio decide ce se poate cheltui.** Hontrio
  stabilește ținta, bugetul, produsele și limitele de siguranță.

---

## 1. Auditul contului (înainte de lansare și apoi zilnic)

Se rulează la cerere (butonul din Campanii) și în cronul zilnic. Rezultatul se
salvează în `google_audits` ca să nu cheltuim operații API la fiecare deschidere a
paginii: accesul Explorer are 2.880 de operații pe zi.

| Verificare | De unde (GAQL) | Blochează lansarea? |
|---|---|---|
| Contul nu e manager, moneda = moneda magazinului | `customer.manager`, `customer.currency_code` | da |
| Etichetarea automată (gclid) pornită | `customer.auto_tagging_enabled` | nu, avertisment |
| Merchant Center legat de cont | `product_link.merchant_center.merchant_center_id` (`type = MERCHANT_CENTER`) | da |
| Conversie de cumpărare activă, principală, cu valoare | `conversion_action.category = PURCHASE`, `status = ENABLED`, `primary_for_goal`, `value_settings` | da, dacă lipsește |
| Conversii în ultimele 30 de zile | `metrics.conversions`, `metrics.conversions_value`, `metrics.cost_micros` din `customer` | nu; alege treapta |
| Campanii fără declarația UE | `campaign.missing_eu_political_advertising_declaration = true` | **da**: din 1.04.2026 o singură campanie nedeclarată blochează orice modificare prin API |
| Campanii Shopping/PMax active pe același Merchant | `campaign.advertising_channel_type IN (SHOPPING, PERFORMANCE_MAX)`, `campaign.shopping_setting.merchant_id` | nu blochează, dar cere o alegere |
| Campanie Search activă | `advertising_channel_type = SEARCH` | nu; decide excluderea brandului |

Când există **campanii nedeclarate**, Hontrio le poate declara „nu conține publicitate
politică UE”. Doar după ce omul bifează explicit că așa e, fiindcă declarația e a lui.
O modificare care atinge doar câmpul ăsta e permisă chiar și când contul e blocat
(pagina EU political advertising din documentația API).

**Campaniile existente care vând aceleași produse.** Din 2024, PMax și Shopping standard
pe aceleași produse nu se mai ordonează automat: câștigă Ad Rank-ul mai mare. Deci ne-am
licita singuri prețul în sus. La lansare omul alege:
- **oprește-le** (recomandat): Hontrio le pune pe pauză, nu le șterge;
- **lasă-le**: Shopping standard primește prioritatea 0, ca ale lui să aibă întâietate,
  iar pagina avertizează că PMax concurează cu ele.

## 2. Treptele

| Treaptă | Când | Ce campanie |
|---|---|---|
| **Pornire** (`starter`) | contul are sub 15 conversii în 30 de zile, minimul Google pentru ROAS țintă la Shopping | **Shopping standard**, CPC manual plafonat, buget de test, limită de pierdere |
| **Creștere** (`growth`) | ≥ 15 conversii în 30 de zile | **Performance Max doar pe feed**, valoare maximă a conversiilor cu ROAS țintă |
| **Segmentare** (`segment`) | campania de creștere are ≥ 42 de zile, ≥ 30 conversii/30 de zile și produse cu praguri de profit diferite | Două PMax: marjă mare / marjă mică, fiecare cu ținta lui |

Conversiile din 30 de zile vin din audit. Până la primul audit se folosesc comenzile
aduse de Google Ads din magazin (gclid/UTM): mai puțin precis, dar în aceeași direcție.

Trecerea **pornire → creștere** e o acțiune propusă (vezi §6): Hontrio creează PMax cu
ținta pornită din ROAS-ul real al campaniei de pornire, apoi o oprește pe cea de pornire.

## 3. Structura campaniilor (câmpurile exacte, REST v26)

### 3.1 Pornire — Shopping standard

O singură cerere `googleAds:mutate`, atomică (`partialFailure: false`), cu ID-uri
temporare negative:
1. `campaignBudgetOperation.create`: `name`, `amountMicros`, `deliveryMethod: STANDARD`, `explicitlyShared: false`.
2. `campaignOperation.create`:
   - `name`: „Hontrio · Pornire · {magazin}”, `status: ENABLED`, `advertisingChannelType: SHOPPING`
   - `shoppingSetting: { merchantId, feedLabel?, campaignPriority: 0|1 }`; prioritatea 0 doar dacă omul își păstrează campaniile
   - `manualCpc: { enhancedCpcEnabled: false }`
   - `networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false }`
   - `geoTargetTypeSetting: { positiveGeoTargetType: PRESENCE }`
   - `containsEuPoliticalAdvertising: DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING`
   - `finalUrlSuffix`: UTM-urile noastre (§3.3)
3. `campaignCriterionOperation.create`: țara (`location.geoTargetConstant`, ID-ul căutat cu GAQL în `geo_target_constant`).
4. `adGroupOperation.create`: `type: SHOPPING_PRODUCT_ADS`, `cpcBidMicros` = plafonul.
5. `adGroupAdOperation.create`: `ad: { shoppingProductAd: {} }`.
6. `adGroupCriterionOperation.create`: arborele de produse.
   - Fără excluderi: o singură rădăcină `UNIT` cu `cpcBidMicros`.
   - Cu excluderi: rădăcina `SUBDIVISION`. Sub ea, câte un `UNIT` cu `negative: true` și `caseValue.productItemId.value` pentru fiecare produs exclus, plus „restul” (`UNIT`, `productItemId: {}`) cu plafonul.

### 3.2 Creștere — Performance Max doar pe feed

O singură cerere atomică, după exemplul oficial `add_performance_max_retail_campaign`:
1. Bugetul, ca mai sus. PMax nu acceptă bugete partajate.
2. `campaignOperation.create`:
   - `advertisingChannelType: PERFORMANCE_MAX`, `status: ENABLED`
   - `shoppingSetting: { merchantId, feedLabel? }`
   - `maximizeConversionValue: { targetRoas }`, ca raport (3,5 = 350%)
   - `geoTargetTypeSetting: { positiveGeoTargetType: PRESENCE }`
   - `containsEuPoliticalAdvertising: DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING`
   - `finalUrlSuffix`: UTM-urile
   - `assetAutomationSettings: [{ assetAutomationType: FINAL_URL_EXPANSION_TEXT_ASSET_AUTOMATION, assetAutomationStatus: OPTED_OUT }]`. Clicurile ajung pe pagina produsului. În v26 câmpul vechi `url_expansion_opt_out` nu mai există.
   - `brandGuidelinesEnabled` rămâne implicit. Campaniile de retail fără materiale proprii sunt scutite de numele firmei și logo la nivel de campanie.
3. `campaignCriterionOperation.create`: țara și limba (`language.languageConstant`, din GAQL `language_constant`).
4. `assetGroupOperation.create`: `name`, `campaign`, `status: ENABLED`, `finalUrls` = adresa magazinului (ca în exemplul oficial).
5. `assetGroupListingGroupFilterOperation.create`: arborele.
   - Fără excluderi: rădăcina `UNIT_INCLUDED`, `listingSource: SHOPPING`.
   - Cu excluderi: rădăcina `SUBDIVISION`, câte un `UNIT_EXCLUDED` pe produs (`caseValue.productItemId.value`) și restul `UNIT_INCLUDED` (`productItemId: {}`).
   - Maximum 1.000 de filtre pe grup.
6. `campaignConversionGoalOperation.update` pe fiecare obiectiv al contului (`customer_conversion_goal`): `biddable` true doar pentru `PURCHASE~WEBSITE`, `updateMask: biddable`. Numele resursei folosește ID-ul temporar al campaniei.
7. Cuvinte negative (`keyword { text, matchType: EXACT|PHRASE }`, `negative: true`):
   - numele magazinului, doar când contul are o campanie Search activă (atunci căutările pe brand sunt ale ei);
   - termenii aprobați de bucla de optimizare.

   PMax acceptă până la 10.000 de cuvinte negative, aplicate doar pe Search și Shopping.

Fără materiale proprii („doar feed”). Google generează ce-i trebuie din feed, iar
bugetul rămâne în principal pe Shopping. Materialele se pot adăuga mai târziu; atunci
trebuie setul complet într-o singură cerere (3–15 titluri, 1–5 titluri lungi, 2–5 descrieri,
o imagine lată și una pătrată, numele firmei și logo la nivel de campanie).

### 3.3 Atribuirea Hontrio

`finalUrlSuffix = utm_source=google&utm_medium=cpc&utm_campaign=hontrio-{campaignid}`.
`{campaignid}` e un parametru ValueTrack. O comandă cu `utm_campaign` `hontrio-<id>` e a
campaniei noastre. Etichetarea automată (gclid) rămâne în paralel, pentru Google.

## 4. Produsele

Motivele de excludere din plan rămân aceleași: fără stoc, respins la Google, preț
neconfirmat, netrimis, marjă negativă sau sub 20%, scos de om.

- **Unde se aplică:** în arborele de produse al campaniei, după ID-ul ofertei din
  Merchant Center (`commerce_offers.merchant_offer_id`). Nu atingem `pause` sau
  `excluded_destination` din feed: acelea ar opri produsul și în campaniile omului.
- **ID-ul din Merchant Center:**
  - la Edinio e `offer_id`;
  - la WooCommerce și Shopify îl aflăm din lista produselor din Merchant API (`products.list`), potrivind după:
    - ID-ul exact;
    - `gla_{id}` (Google for WooCommerce);
    - `shopify_{ȚARĂ}_{produs}_{variantă}` (aplicația Google & YouTube);
    - SKU, link sau GTIN.
  - O ofertă fără potrivire nu poate fi exclusă după ID. Pagina spune câte sunt.
- **Peste 900 de excluderi**, sau segmentare: eticheta `custom_label_N` pusă de Hontrio
  în sursa suplimentară. N e primul index pe care feedul omului nu-l folosește. Arborele
  filtrează apoi după `productCustomAttribute { index: INDEXn, value }`.

## 5. Licitarea și bugetul

Notații din `lib/ads/economics.ts`:
- `prag` = ROAS-ul de la care vânzarea își plătește reclama = `TVA × (total ÷ produse) ÷ (marjă − reduceri)`;
- `țintă(obiectiv)` = `prag ÷ (1 − cât păstrezi)`, cu „cât păstrezi” 10/25/40%;
- `valoare medie` = valoarea medie a comenzii raportată ca valoare a conversiei.

- **Bugetul propus** = 30 de conversii pe lună × valoarea medie ÷ țintă ÷ 30,4 (cum era).
  Google poate cheltui până la dublu într-o zi, dar nu peste 30,4 bugete pe lună.
- **Plafonul de CPC la pornire** = valoarea medie × rata de conversie presupusă ÷ prag.
  - Rata presupusă e 1%, prudentă pentru Shopping.
  - Sub 0,05 în moneda contului avertizăm: campania va avea foarte puțin trafic.
- **Limita de pierdere (pornire și creștere)**, unde `CPA la prag` = valoarea medie ÷ prag:
  - campania s-a oprit dacă a cheltuit ≥ 3 × CPA la prag fără nicio conversie;
  - sau dacă a cheltuit ≥ 6 × CPA la prag cu ROAS sub jumătate din prag.

  Oprirea se face și în modul cu aprobare, fiindcă e protecție, iar omul primește
  notificare. Dacă o repornește, socoteala începe de la zero.
- **Ținta la creștere:** pornește de la ROAS-ul real din ultimele 30 de zile, fără ultimele
  2 (întârzierea conversiilor), dar nu sub prag și nici peste 1,5 × ținta obiectivului
  (o țintă prea strictă ar lăsa campania nouă fără trafic). Apoi se mută spre ținta obiectivului cu
  cel mult 12% o dată (§6). Google cere ca ținta să plece din ROAS-ul istoric; una prea
  mare taie traficul.

## 6. Bucla de optimizare (cron zilnic)

Date:
- metrici pe zi, pe campanie (`campaign` + `segments.date`);
- metrici pe produs (`shopping_performance_view` + `segments.product_item_id`);
- termeni de căutare (`search_term_view` la Shopping, `campaign_search_term_view` la PMax), pe 30 de zile;
- starea campaniei (`campaign.primary_status_reasons`, `campaign_budget.has_recommended_budget`).

Ferestre: 30 de zile fără ultimele 2, ca evaluare; 14 zile, ca semnal recent.

**Protecții:**
- **Învățarea.** Google cere ca o campanie nouă să ruleze cel puțin 6 săptămâni fără
  schimbări dese de buget, licitare sau stare. În primele 42 de zile ale unei campanii
  PMax rulează doar limita de pierdere.
- **Ritmul schimbărilor:**
  - ținta: o schimbare la cel puțin 14 zile, cu maximum ±12%;
  - bugetul: o schimbare la cel puțin 7 zile, cu maximum ±20%.
- **Limitele de sus și de jos.** Ținta nu coboară sub prag. Bugetul nu urcă peste
  bugetul maxim ales de om; fără buget maxim, creșterile rămân doar propuneri.

**Reguli (în ordine):**
1. **Limita de pierdere**: oprește campania (§5).
2. **Trecerea la creștere**: campania de pornire are ≥ 14 zile și contul ≥ 15 conversii în 30 de zile → PMax.
3. **Ținta** (PMax, după învățare, ≥ 10 conversii în 14 zile):
   - ROAS-ul real e sub prag → ridică ținta (+12%, cel puțin până la prag);
   - ținta e sub cea a obiectivului și campania o atinge → +12%, spre obiectiv;
   - ținta e peste cea a obiectivului și campania cheltuie sub 70% din buget → −12%, spre obiectiv, nu sub prag.
4. **Bugetul**: campania e limitată de buget (`BUDGET_CONSTRAINED` sau buget recomandat
   peste cel actual) și ROAS-ul real ≥ ținta → +20%, până la bugetul maxim.
5. **Produsele** (≥ 21 de zile de date):
   - produsul a cheltuit ≥ 2 × CPA-ul lui la prag fără nicio conversie → exclude;
   - produsul are ROAS sub pragul lui, cu cheltuială ≥ 1 × CPA → exclude.
6. **Termenii de căutare**: termenii cu cost ≥ 2 × CPA la prag și nicio conversie în 30 de zile devin cuvânt negativ exact.
7. **Segmentarea** (§2): propusă o singură dată. Grupele se fac după mediana pragului pe produs, fiecare grupă cu ≥ 15 conversii în 30 de zile.

**Modurile:**
- **Cu aprobare** (implicit): acțiunile apar în Campanii ca propuneri, iar omul le aprobă
  sau le respinge. O propunere nedecisă expiră după 7 zile.
- **Automat:** acțiunile se aplică singure și se trec în jurnal, iar omul primește notificare.
- În ambele moduri, protecția (limita de pierdere) se aplică singură.

Fiecare acțiune se scrie în `ad_actions`: tipul, parametrii, motivul (cheie de
traducere), starea (`proposed`, `applied`, `rejected`, `failed`, `expired`) și cine a decis.

## 7. Profitul în Google

Google raportează profitul brut și poate licita pe profit (în beta) doar dacă are două lucruri:
1. **Costul produsului** în Merchant Center (`cost_of_goods_sold`). Hontrio îl trimite din
   costurile lui, prin sursa suplimentară „Hontrio”.
   - Se creează cu `datasources.create { displayName, supplementalProductDataSource: {} }`, fără etichetă și limbă, deci se aplică oricărei surse principale.
   - Se leagă de sursa principală a produselor prin `PATCH …/dataSources/{principală}?updateMask=primaryProductDataSource.defaultRule`. Lista se trimite întreagă: `self` și sursele existente rămân în față, a noastră e ultima.
   - Fiecare produs se trimite cu `productInputs:insert?dataSource=…`, cu `offerId`, `contentLanguage`, `feedLabel` și `productAttributes.costOfGoodsSold { amountMicros, currencyCode }`.
   - Se trimite doar ce s-a schimbat. Un cost șters se scoate cu `productInputs.delete`.
   - **Fără TVA:** în coșul trimis la Google, prețul produsului e fără TVA, transport și
     reduceri. Costul trebuie să fie pe aceeași bază, ca profitul să iasă corect, deci
     costul cu TVA se împarte la `1 + TVA`.
2. **Coșul în conversie** (`gtag('event', 'purchase', …)` cu `items[{ id, quantity, price }]`,
   `discount`, `aw_merchant_id`, `aw_feed_country`, `aw_feed_language`). Cu `'conversion'`
   coșul nu se citește. Se face în Edinio, pe pagina de confirmare:
   - `id` = ID-ul ofertei din Merchant Center;
   - prețul fără TVA, înainte de reducerile pe comandă;
   - reducerile pe comandă, tot fără TVA, în `discount`;
   - valoarea conversiei rămâne totalul comenzii.

   Edinio spune conectorului că trimite coșul (`google_ads.cos: true`), ca Recomandările
   să știe.

## 8. Datele de piață (Merchant API Reports)

`POST /reports/v1/accounts/{id}/reports:search`, o dată pe zi. Rezultatele se salvează în
`merchant_insights`. Rapoartele sunt disponibile doar dacă contul e eligibil; altfel
lipsesc fără eroare.
- `price_competitiveness_product_view`: prețul tău față de prețul de referință din țară.
  Recomandare: produsele mai scumpe cu ≥ 5% decât piața, ordonate după vânzări.
- `price_insights_product_view`: prețul sugerat de Google și schimbarea estimată a
  conversiilor. Recomandare: produsele unde Google estimează ≥ 10% mai multe conversii
  la prețul sugerat.
- `best_sellers_product_cluster_view` (`report_granularity = WEEKLY`, țara magazinului,
  `inventory_status = NOT_IN_INVENTORY`, `brand_inventory_status = IN_STOCK`): produsele
  căutate ale brandurilor pe care le vinzi deja, dar care îți lipsesc din catalog.

## 9. CSS (UE/SEE)

În SEE, reclamele Shopping trec printr-un CSS (serviciu de comparare a prețurilor),
ales în Merchant Center. Implicit e cel al Google. Partenerii CSS spun că scad costul pe
click cu ~20%, dar cifra vine de la ei. Recomandarea apare o dată pentru magazinele din
SEE, cu linkul către pagina Google despre CSS.

## 10. Datele (migrarea 015)

- `stores`:
  - `merchant_center_id`, `merchant_feed_label`, `merchant_content_language`;
  - `merchant_data_source`: sursa suplimentară Hontrio;
  - `merchant_label_index`;
  - `merchant_synced_at`, `merchant_error`;
  - `send_costs_to_google` (implicit da).
- `commerce_offers`: `merchant_offer_id`, `merchant_issues`, `merchant_cogs_pushed`, `merchant_label_pushed`.
- `ad_campaigns`:
  - `type` acceptă și `shopping`; `status` acceptă și `ended`;
  - pe ciornă (setările): `mode`, `max_daily_budget`;
  - pe campaniile lansate:
    - legătura cu Google: `stage`, `segment`, `merchant_center_id`, `feed_label`, `google_budget_id`, `google_asset_group_id`, `google_ad_group_id`;
    - ce s-a aplicat: `target_roas`, `cpc_ceiling`, `excluded_item_ids`;
    - când s-a schimbat: `target_changed_at`, `budget_changed_at`, `loss_check_from`;
    - starea: `last_synced_at`, `last_error`, `paused_reason`.
- `google_audits` (un rând pe magazin), `ad_metrics_daily`, `ad_product_metrics_daily`,
  `ad_search_terms`, `ad_actions`, `merchant_insights`.

Toate au RLS pornit și le citește doar serverul, ca `commerce_*`.

## 11. API intern

- `GET /api/campaigns/plan`: planul, auditul salvat, campaniile lansate, propunerile, ultimele metrici.
- `PATCH /api/campaigns/plan`: obiectivul, bugetul, modul, bugetul maxim.
- `POST /api/campaigns/audit`: rulează auditul acum.
- `POST /api/campaigns/launch`: lansează treapta din plan, cu alegerea pentru campaniile existente și confirmarea declarației UE.
- `POST /api/campaigns/actions`: aprobă sau respinge o propunere.
- `PATCH /api/campaigns/{id}`: pauză sau repornire, cerute de om.
- `GET /api/reports`: Rapoartele.
- `POST /api/merchant/sync`: reîmprospătează datele din Merchant Center.
- `GET/PATCH /api/integrations/google/merchant`: contul Merchant al magazinului și trimiterea costurilor.
- Cron `/api/cron/ads-sync`, zilnic: auditul, metricile, Merchant Center și bucla.

## 12. Ce rămâne de verificat pe primul cont real

Totul e construit după documentație și verificat pe un API simulat. La primul cont real
(după accesul la Google Ads API și testul OAuth):
- că `googleAds:mutate` primește operațiile exact cum sunt construite. Primul pas al
  lansării e oricum un `validateOnly: true`, care întoarce erorile fără să creeze nimic;
- ID-urile de ofertă la WooCommerce (`gla_…`) și Shopify (`shopify_…`), pe un Merchant
  Center real;
- legarea sursei suplimentare la o sursă principală gestionată de altă aplicație (Edinio,
  Google for WooCommerce, Google & YouTube);
- eligibilitatea rapoartelor de piață pentru conturile din România;
- că profitul brut apare în Google Ads după ce Edinio trimite coșul.

## Surse

- Google Ads API: [PMax pentru retail](https://developers.google.com/google-ads/api/performance-max/retail), [crearea campaniei PMax](https://developers.google.com/google-ads/api/performance-max/create-campaign), [materiale](https://developers.google.com/google-ads/api/performance-max/asset-requirements), [grupuri de produse](https://developers.google.com/google-ads/api/performance-max/listing-groups), [criterii PMax](https://developers.google.com/google-ads/api/performance-max/create-campaign-criteria), [Shopping standard](https://developers.google.com/google-ads/api/docs/shopping-ads/create-campaign), [declarația UE](https://developers.google.com/google-ads/api/docs/api-policy/eu-par), [limite](https://developers.google.com/google-ads/api/docs/best-practices/system-limits), [raportare PMax](https://developers.google.com/google-ads/api/performance-max/reporting)
- Definițiile v26: `googleapis/googleapis` → `google/ads/googleads/v26`, exemplul [add_performance_max_retail_campaign.py](https://github.com/googleads/google-ads-python/blob/main/examples/shopping_ads/add_performance_max_retail_campaign.py)
- Merchant API: [surse API suplimentare](https://developers.google.com/merchant/api/guides/data-sources/api-sources), `googleapis/googleapis` → `google/shopping/merchant/{products,datasources,reports}/v1`, [oprirea Content API](https://developers.google.com/shopping-content/guides/deprecation-and-sunset), [specificația produselor](https://support.google.com/merchants/answer/7052112)
- Google Ads Help:
  - campanii: [PMax și celelalte campanii](https://support.google.com/google-ads/answer/13810170), [ROAS țintă](https://support.google.com/google-ads/answer/6268637), [optimizare PMax (6 săptămâni)](https://support.google.com/google-ads/answer/11385582), [cuvinte negative PMax](https://support.google.com/google-ads/answer/15726455)
  - profit: [conversii cu coș](https://support.google.com/google-ads/answer/9028254), [parametrii coșului](https://support.google.com/google-ads/answer/14943675), [exemplul de tag](https://support.google.com/google-ads/answer/14944137)
  - CSS: [lucrul cu CSS](https://support.google.com/merchants/answer/12652686)
- Din piață: [strategia hibridă PMax + Shopping (SEJ, mai 2026)](https://searchenginejournal.com/performance-max-for-ecommerce-the-hybrid-strategy-thats-actually-working/571885/), [AI Max pentru Shopping](https://ppc.land/google-brings-ai-max-to-shopping-campaigns-targeting-conversational-queries/)
