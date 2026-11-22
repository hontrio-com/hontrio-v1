# Campaniile Google Shopping în Hontrio — specificație

Scrisă pe 25.10.2026, după documentația oficială Google Ads API v26 (fișierele `.proto`
din `googleapis/googleapis`, exemplele `google-ads-python`), Merchant API v1 și
paginile Google Ads Help. Sursele sunt la final. Ce n-am putut verifica pe un cont
real e marcat **neverificat**.

**10.11.2026: fără marje.** Hontrio doar creează și îngrijește campaniile. Nu cere și nu
folosește costurile produselor, deci nu mai are prag de profit, obiective, ținte ROAS,
împărțire pe marje sau profit afișat. Secțiunile de mai jos descriu regulile de acum.

Principii:
- **Singura pierdere sigură e ROAS sub 1.** Fără marje, Hontrio nu știe ce vânzare e
  profitabilă. Știe doar când o reclamă a costat mai mult decât au adus vânzările ei, și
  asta oprește singur. Unitatea de măsură e comanda medie (`lib/ads/economics.ts`).
- **Banii îi decide omul.** Bugetul îl alege omul; pilotul doar propune creșteri, care se
  aplică numai cu aprobarea lui, în orice mod.
- **Nu stricăm ce e al omului.** Nu dublăm feedul și nu schimbăm conversia de
  cumpărare. Campaniile existente le atingem doar cu acordul lui explicit.
- **Ce trimitem în Merchant Center** merge într-o sursă suplimentară a noastră, legată
  ultima (cea mai mică prioritate). Nu suprascrie nimic din feedul omului.
- **Google decide licitația pe click; Hontrio îngrijește campania.** Hontrio alege
  treapta și produsele, pune limitele de siguranță și propune bugetul.

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
| Conversie de cumpărare activă, principală, cu valoare | `conversion_action.category = PURCHASE`, `status = ENABLED`, `primary_for_goal`, `value_settings` | da, la ambele trepte; și când are mereu aceeași valoare (`always_use_default_value`) |
| Conversii în ultimele 30 de zile | `metrics.conversions`, `metrics.conversions_value`, `metrics.cost_micros` pe campanii; cumpărările separat (`segments.conversion_action_category = PURCHASE`, din `customer`) | nu; cumpărările aleg treapta |
| Campanii fără declarația UE | `campaign.missing_eu_political_advertising_declaration = true` | **da**: din 1.04.2026 o singură campanie nedeclarată blochează orice modificare prin API |
| Campanii Shopping/PMax active pe același Merchant | `campaign.advertising_channel_type IN (SHOPPING, PERFORMANCE_MAX)`, `campaign.shopping_setting.merchant_id` | nu blochează, dar cere o alegere |
| Campanie Search activă | `advertising_channel_type = SEARCH` | nu; decide excluderea brandului |

**Conversia fără valoarea comenzii** oprește lansarea la ambele trepte, nu doar la creștere:
oprirea de siguranță, produsele și bugetul se judecă după ROAS, iar cu o valoare fixă (de
exemplu 1 leu pe comandă) o campanie care vinde ar arăta ROAS aproape zero și ar fi oprită.
Un audit salvat înainte, care o avea doar ca avertisment, blochează la fel.

**Cumpărările din 30 de zile** se citesc cu o interogare separată, care nu oprește auditul:
dacă Google n-o primește, treapta folosește toate conversiile contului, ca înainte.

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
| **Pornire** (`starter`) | contul are sub 15 cumpărări în 30 de zile, minimul Google pentru licitarea pe valoare la Shopping | **Shopping standard**, „Maximizează clicurile” cu plafon pe click, oprire de siguranță |
| **Creștere** (`growth`) | ≥ 15 cumpărări în 30 de zile | **Performance Max doar pe feed**, „Maximizează valoarea conversiilor” fără ROAS țintă |

Treapta „segmentare” (două PMax, pe marjă mare și mică) a existat până la 10.11.2026;
campaniile vechi `stage = segment` rulează mai departe ca PMax obișnuite.

Conversiile din 30 de zile vin din audit și sunt doar cumpărările: PMax licitează numai pe
`PURCHASE~WEBSITE`, deci un „adaugă în coș” marcat principal nu contează. Dacă interogarea
cumpărărilor n-a mers (sau auditul e mai vechi), se folosesc toate conversiile contului (§1).
Până la primul audit se folosesc comenzile aduse de Google Ads din magazin (gclid/UTM): mai
puțin precis, dar în aceeași direcție.

Trecerea **pornire → creștere** e o acțiune propusă (vezi §6): Hontrio creează PMax fără
țintă, cu același buget, apoi o oprește pe cea de pornire.

## 3. Structura campaniilor (câmpurile exacte, REST v26)

### 3.1 Pornire — Shopping standard

O singură cerere `googleAds:mutate`, atomică (`partialFailure: false`), cu ID-uri
temporare negative:
1. `campaignBudgetOperation.create`: `name`, `amountMicros`, `deliveryMethod: STANDARD`, `explicitlyShared: false`.
2. `campaignOperation.create`:
   - `name`: „Hontrio · Pornire · {magazin}”, `status: ENABLED`, `advertisingChannelType: SHOPPING`
   - `shoppingSetting: { merchantId, feedLabel?, campaignPriority: 0|1 }`; prioritatea 0 doar dacă omul își păstrează campaniile
   - `targetSpend: { cpcBidCeilingMicros }` („Maximizează clicurile”, cu plafonul din §5); fără plafon, `targetSpend: {}`
   - `networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false }`
   - `geoTargetTypeSetting: { positiveGeoTargetType: PRESENCE }`
   - `containsEuPoliticalAdvertising: DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING`
   - `finalUrlSuffix`: UTM-urile noastre (§3.3)
3. `campaignCriterionOperation.create`: țara (`location.geoTargetConstant`, ID-ul căutat cu GAQL în `geo_target_constant`).
4. `adGroupOperation.create`: `type: SHOPPING_PRODUCT_ADS`, fără ofertă (licitează Google). **Neverificat**: că API-ul acceptă grupul și nodurile fără `cpcBidMicros` la „Maximizează clicurile”.
5. `adGroupAdOperation.create`: `ad: { shoppingProductAd: {} }`.
6. `adGroupCriterionOperation.create`: arborele de produse.
   - Fără excluderi: o singură rădăcină `UNIT`.
   - Cu excluderi: rădăcina `SUBDIVISION`. Sub ea, câte un `UNIT` cu `negative: true` și `caseValue.productItemId.value` pentru fiecare produs exclus, plus „restul” (`UNIT`, `productItemId: {}`).
   - Nodurile nu au ofertă; o campanie veche cu CPC manual folosește oferta grupului de anunțuri.

### 3.2 Creștere — Performance Max doar pe feed

O singură cerere atomică, după exemplul oficial `add_performance_max_retail_campaign`:
1. Bugetul, ca mai sus. PMax nu acceptă bugete partajate.
2. `campaignOperation.create`:
   - `advertisingChannelType: PERFORMANCE_MAX`, `status: ENABLED`
   - `shoppingSetting: { merchantId, feedLabel? }`
   - `maximizeConversionValue: {}`, fără ROAS țintă: Google aduce cea mai mare valoare a vânzărilor din buget
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
   - termenii aprobați de bucla de optimizare; la trecerea pornire → creștere, cei puși deja pe
     campania de pornire trec în PMax.

   PMax acceptă până la 10.000 de cuvinte negative, aplicate doar pe Search și Shopping. Textul
   fiecăruia trece întâi prin `cleanKeyword` (§6, regula 5).

Fără materiale proprii („doar feed”). Google generează ce-i trebuie din feed, iar
bugetul rămâne în principal pe Shopping. Materialele se pot adăuga mai târziu; atunci
trebuie setul complet într-o singură cerere (3–15 titluri, 1–5 titluri lungi, 2–5 descrieri,
o imagine lată și una pătrată, numele firmei și logo la nivel de campanie).

### 3.3 Atribuirea Hontrio

`finalUrlSuffix = utm_source=google&utm_medium=cpc&utm_campaign=hontrio-{campaignid}`.
`{campaignid}` e un parametru ValueTrack. O comandă cu `utm_campaign` `hontrio-<id>` e a
campaniei noastre. Etichetarea automată (gclid) rămâne în paralel, pentru Google.

## 4. Produsele

Motivele de excludere din plan: fără stoc, respins la Google, preț neconfirmat, netrimis,
scos de om, scos de pilot (§6).

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
- **Peste 990 de excluderi**: eticheta `custom_label_N` pusă de Hontrio
  în sursa suplimentară. N e primul index pe care feedul omului nu-l folosește. Arborele
  filtrează apoi după `productCustomAttribute { index: INDEXn, value }`.
- **Când stă eticheta pe oferte** îl hotărăște o singură regulă, `merchantLabels`
  (`lib/ads/listing.ts`): pe ofertele scoase, cât timp arborele unei campanii care rulează (sau
  al celei care se lansează acum) filtrează după ea, oricum s-ar schimba treapta planului;
  altfel se scoate. O folosesc toți cei care sincronizează Merchant Center: lansarea, pilotul și
  butonul din Setări. Fără plan (citirea lui a eșuat), etichetele rămân cum sunt (`'keep'`).

## 5. Licitarea și bugetul

Unitatea de măsură e **comanda medie** (`economics.aov`): totalul comenzilor de pe site din
90 de zile ÷ numărul lor; fără comenzi, prețul mediu al produselor care pot rula.

- **Bugetul pe zi** îl alege omul. Propunerea:
  - cât cheltuie contul acum pe zi pe Shopping și Performance Max (`shopping_cost30 ÷ 30`, din audit);
  - altfel o cincime din comanda medie (de exemplu 50 lei pe zi la o comandă medie de 250 lei);
  - rotunjită ușor de citit (din 5 în 5 peste 20, din 10 în 10 peste 100).
- **Plafonul pe click la pornire** = 1% din comanda medie: la o vânzare din 100 de clicuri,
  vânzarea își acoperă reclama. Sub 0,05 în moneda contului avertizăm: campania va avea foarte
  puțin trafic.
- **Oprirea de siguranță (pornire și creștere)**, de la lansare sau de la ultima repornire
  (`loss_check_from`), oricât de demult ar fi: fereastra nu se taie la 30 sau 45 de zile, ca o
  campanie care pierde încet să ajungă totuși la limită:
  - campania a cheltuit ≥ 1 × comanda medie fără nicio vânzare;
  - sau ≥ 3 × comanda medie, cu vânzări sub costul reclamei (ROAS sub 1).

  Vânzările (22.11.2026) sunt conversiile Google sau comenzile din magazin aduse de campanie
  (sursa `hontrio-<ID>`, neanulate, plasate după lansare sau repornire), care sunt mai multe,
  la număr și la valoare. Așa o conversie nemăsurată (eticheta stricată, cookie-urile refuzate)
  nu oprește o campanie care vinde. Prima comandă VetDepo din campanie (21.11.2026) nu a ajuns
  în Google. Când magazinul are comenzi din campanii, iar Google nicio conversie, recomandarea
  `conversions_unrecorded` îi spune omului să verifice conversia. Trecerea pe Performance Max și
  restul buclei rămân pe conversiile Google, pentru că după ele licitează Google.

  La campania unei grupe, comanda medie (deci și limita) e a grupei (§13), nu a magazinului.
  Oprirea se face și în modul cu aprobare, fiindcă e protecție, iar omul primește
  notificare și e-mail (§6, „Ce află omul”). Dacă o repornește, socoteala începe de la zero.
- **Performance Max** pornește și rămâne fără ROAS țintă. Ținta unei campanii vechi (făcută
  înainte de 10.11.2026) rămâne cea din Google; Hontrio n-o mai schimbă.

## 6. Bucla de optimizare (cron zilnic)

**O trecere pe magazin**, în ordinea asta, ca nimic să nu poată întârzia protecția:
1. **Protecția întâi:** metricile pe campanie, starea campaniilor din Google, apoi oprirea de
   siguranță (§5).
2. **Restul datelor:** auditul (dacă e mai vechi de o zi), metricile pe produs, termenii de
   căutare, Merchant Center.
3. **Bucla** (regulile de mai jos, fără oprirea făcută deja la pasul 1), apoi arborii de produse
   puși la zi cu planul.

Date:
- metrici pe zi, pe campanie (`campaign` + `segments.date`);
- metrici pe produs (`shopping_performance_view` + `segments.product_item_id`);
- termeni de căutare (`search_term_view` la Shopping, `campaign_search_term_view` la PMax), pe 30 de zile;
- starea campaniei (`campaign.primary_status_reasons`, `campaign_budget.has_recommended_budget`).

Metricile se recitesc la fiecare trecere pe **cel puțin ultimele 33 de zile** (90 la prima
citire a unui cont). Google trece conversiile pe ziua clicului, chiar dacă sosesc zile mai
târziu: altfel o vânzare raportată târziu n-ar mai ajunge în cifre, iar ROAS-ul ar ieși mai mic.
Citirile din bază se fac pagină cu pagină (API-ul întoarce cel mult 1.000 de rânduri pe cerere).

**Cifrele de azi (migrarea 030):** trecerea citește doar zilele încheiate, o dată la ~20 de ore, așa
că o campanie lansată azi n-ar avea cifre în pagină până mâine după-amiază. De aceea, în timpul
rămas din fiecare oră, cronul citește pentru magazinele cu campanii pornite și zilele de după ultima
trecere, până azi (cel puțin de ieri), cu două cereri la Google pe magazin: metricile pe zi și pe
campanie și, pentru ieri și azi, cele pe produs (fișa campaniei). Când a făcut-o se scrie în `stores.ads_today_at`. Paginile arată atunci și ziua de
azi. Pilotul judecă tot doar până ieri, deci oprirea de siguranță și bucla nu se schimbă.

Ferestre: 30 de zile fără ultimele 2, ca evaluare; 14 zile, ca semnal recent.

**Când se socotește trecerea făcută.** `stores.ads_synced_at` (ora de început a trecerii) se
scrie doar când trecerea a ajuns la capăt, sau s-a oprit într-o eroare care nu trece singură (un
drept lipsă, o interogare refuzată, accesul retras); următoarea vine atunci peste ~20 de ore.
Timpul cronului și erorile trecătoare (limită de cereri, cotă, 5xx, un token care nu s-a putut
reîmprospăta) nu o scriu: magazinul revine la ora următoare, primul la rând. Excepție: un magazin
care a fost primul în rularea cronului și tot n-a încăput se socotește trecut (`deadline_full`),
ca să nu se reia la nesfârșit; oprirea lui de siguranță a rulat oricum. Eroarea rămâne în
`stores.ads_sync_error` și se vede în Campanii și în Rapoarte; o trecere reușită o șterge.

`ads_synced_at` redevine null când omul alege alt cont Google Ads sau alt Merchant Center (și
când contul magazinului se alege singur sau dispare): pilotul îl citește la următoarea oră, cu
tot istoricul de 90 de zile.

**Protecții:**
- **Învățarea.** Google cere ca o campanie nouă să ruleze cel puțin 6 săptămâni fără
  schimbări dese de buget sau stare. În primele 42 de zile ale unei campanii PMax pilotul nu-i
  propune buget nou.
- **Ritmul schimbărilor:** bugetul, cel mult o dată la 7 zile, cu cel mult +20%.
- **Bugetul maxim** ales de om e pentru toate campaniile Hontrio care rulează, la un loc
  (campania principală și grupele): propunerile nu trec de el, nici împreună (creșterile propuse
  în aceeași trecere se adună). La aprobare se verifică din nou, cu bugetele de atunci: noul buget
  se micșorează până încape, iar dacă nu mai încape nimic peste cel de acum, propunerea nu se aplică.

**Reguli (în ordine):**
1. **Oprirea de siguranță** (§5): oprește campania.
2. **Trecerea la creștere**: campania de pornire are ≥ 14 zile și contul ≥ 15 cumpărări în 30
   de zile (§2) → PMax fără țintă, cu bugetul de acum al pornirii și cu negativele puse deja pe
   ea. Campania unei grupe trece după conversiile ei (§13), nu ale contului.
   - Se poate relua: dacă o trecere de mai înainte a creat deja PMax-ul, dar n-a apucat să oprească
     pornirea, acum doar o oprește (nu mai creează altul).
   - PMax-ul creat în Google, dar nesalvat în Hontrio, se pune pe pauză și se scrie în jurnal:
     fără rândul lui n-ar avea oprire de siguranță.
   - Dacă arborele PMax-ului ar trece de 990 de produse, pornirea rămâne pornire: pilotul nici nu
     propune trecerea.
3. **Bugetul**: campania e limitată de buget (`BUDGET_CONSTRAINED` sau buget recomandat peste
   cel actual), are vânzări și ROAS ≥ 1 în fereastra de evaluare → propune +20%, până la bugetul
   maxim. **Mereu cu aprobarea omului**, și în modul automat.
4. **Produsele** (≥ 21 de zile de date ale produsului: de la prima lui zi cu cifre în campaniile
   Hontrio, nu de la lansarea campaniei; un produs nou n-are cum să fie judecat după o zi):
   - produsul a cheltuit ≥ prețul lui fără nicio vânzare → exclude;
   - produsul are vânzări, dar ROAS sub 1 → exclude.

   Fără preț, unitatea e comanda medie. Omul îl poate include la loc.
5. **Termenii de căutare**: termenii cu cost ≥ comanda medie și nicio conversie în 30 de zile
   devin cuvânt negativ exact.
   - Numele magazinului nu devine niciodată negativ, scris oricum: comparația e fără diacritice,
     spații și semne („Lumină Design” = „lumina design” = „luminadesign.ro”).
   - Textul trimis la Google trece prin `cleanKeyword`: doar litere, cifre și `& ' . -`, cel mult
     10 cuvinte și 80 de caractere, tăiat la un cuvânt întreg; un termen care rămâne gol se sare.
     Cererea e atomică: un singur termen invalid ar strica toată propunerea.

Propunerile vechi de schimbare a țintei (`set_target`) și de împărțire pe marje (`segment`)
expiră la prima trecere și nu se mai aplică.

**Modurile:**
- **Cu aprobare** (implicit): acțiunile apar în Campanii ca propuneri, iar omul le aprobă
  sau le respinge. Singur, pilotul face doar oprirea de siguranță, ține la zi lista de produse a
  campaniilor (arborii, după alegerile omului, stoc și grupe) și oprește campaniile programate la
  data lor de final.
  - O propunere nedecisă expiră după 7 zile. Cronul o trece expirată, iar aprobarea verifică și
    ea vârsta: una mai veche nu se mai aplică, chiar dacă cronul n-a apucat s-o treacă așa.
  - O singură hotărâre pe propunere: cererea care o ia (`decided_at`) o duce la capăt, iar un
    dublu clic sau două file deschise nu o aplică de două ori. O cerere căzută o eliberează (cel
    târziu după 10 minute).
- **Automat:** acțiunile se aplică singure și se trec în jurnal, iar omul primește notificare.
  Bugetul rămâne propunere.
- În ambele moduri, protecția (oprirea de siguranță) se aplică singură.

**Ce află omul**, în clopoțel (`notifications`) și pe e-mail, în limba lui (`users.ui_locale`).
E-mailurile pleacă doar dacă n-a oprit notificările pe e-mail (`users.preferences.emailNotifications`,
implicit pornite):
1. **Oprirea de siguranță a pus o campanie pe pauză:** notificare și e-mail, de fiecare dată.
2. **Campaniile rulează fără protecție:** notificare și e-mail.
   - Oprirea n-a reușit (Google a refuzat-o): cel mult o dată pe zi pentru aceeași campanie; pilotul
     o reîncearcă la fiecare trecere.
   - Pilotul n-a putut citi contul: o dată pe întâmplare (de la ultima trecere reușită); la o eroare
     trecătoare, abia după o zi întreagă fără trecere.
   - Hontrio a pierdut accesul la Google: o dată, când conexiunea trece din activă în retrasă, și
     doar dacă rulează campanii Hontrio.
3. **Propuneri noi:** notificare la fiecare trecere care le aduce; e-mail cel mult o dată pe zi
   pe magazin.

În modul automat, omul mai primește o notificare cu câte schimbări s-au aplicat.

Fiecare acțiune se scrie în `ad_actions`: tipul, parametrii, motivul (cheie de
traducere), starea (`proposed`, `applied`, `rejected`, `failed`, `expired`) și cine a decis.

**Cifrele arătate** (Campanii, Rapoarte, Prezentarea generală) sunt cele raportate de Google:
cheltuiala, valoarea vânzărilor, ROAS-ul, conversiile și costul pe conversie. Hontrio nu
afișează profit.

## 7. Costurile produselor

Până la 10.11.2026, Hontrio trimitea costul produselor în Merchant Center
(`cost_of_goods_sold`, în sursa suplimentară „Hontrio”), pentru profitul brut din Google
Ads. Nu mai trimite: la prima trecere, un cost trimis înainte se scoate (produsul rămâne doar
cu eticheta, sau dispare din sursa suplimentară). Coloanele de cost din baza de date
(`commerce_offers.cost_price`, `cost_source`, `stores.send_costs_to_google`) rămân nefolosite.

Edinio trimite în continuare coșul în conversia de cumpărare (`google_ads.cos`); Hontrio nu
se mai bazează pe el.

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
  - `ads_synced_at`, `ads_sync_error`: ultima trecere a pilotului și de ce n-a putut lucra (§6);
  - `send_costs_to_google` (nefolosită din 10.11.2026).
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

- `GET /api/campaigns/plan`: planul, auditul salvat, campaniile lansate, propunerile (fără cele mai vechi de 7 zile), ultimele metrici (până azi, dacă cifrele de azi au fost citite), ultima trecere a pilotului și eroarea ei.
- `PATCH /api/campaigns/plan`: bugetul, modul, bugetul maxim.
- `POST /api/campaigns/audit`: rulează auditul acum.
- `POST /api/campaigns/launch`: lansează treapta din plan (sau campania unei grupe, cu `group_id`), cu alegerea pentru campaniile existente și confirmarea declarației UE.
- `POST /api/campaigns/groups`, `PATCH/DELETE /api/campaigns/groups/{id}`: grupele de produse ale omului (§13).
- `POST /api/campaigns/actions`: aprobă sau respinge o propunere (verifică vârsta ei, o ia o singură cerere, iar bugetul se verifică din nou față de bugetul maxim, §6).
- `PATCH /api/campaigns/{id}`: pauză sau repornire, cerute de om.
- `GET /api/reports`: Rapoartele.
- `POST /api/merchant/sync`: reîmprospătează datele din Merchant Center (etichetele, după `merchantLabels`, §4).
- `GET/PATCH /api/integrations/google/merchant`: contul Merchant al magazinului; alegerea lui, ca și
  a contului Google Ads (`PATCH /api/integrations/google/accounts`), pune pilotul la rând la ora următoare (§6).
- Cron `/api/cron/ads-sync`, din oră în oră, o trecere pe zi pe magazin: oprirea de siguranță întâi,
  apoi auditul, metricile, Merchant Center și bucla (§6). În timpul rămas, cifrele de azi ale
  magazinelor cu campanii pornite (§6). Secretul cronului se compară în timp constant.

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
- campaniile pe grupe (§13): arborele cu lista de produse incluse la Shopping standard și
  `start_date_time` / `end_date_time` cu granularitate de zi, pe ambele tipuri;
- „Maximizează clicurile” la Shopping standard: `targetSpend` cu `cpcBidCeilingMicros`, grupul de anunțuri și nodurile fără ofertă.

## 13. Campaniile pe grupe de produse (făcute de om)

Pe lângă campania principală, omul își poate face campanii pe o parte din catalog: o
categorie, un brand, un interval de preț, produsele cu reducere sau produse alese de el,
și orice combinație. Fiecare grupă are campania ei în Google Ads, cu bugetul și treapta ei,
iar pilotul o îngrijește cu aceleași reguli (§6). Cod:
`lib/campaigns/groups.ts` (funcții pure, folosite și de editorul din pagină, ca cifrele
din previzualizare să fie cele de la lansare).

**Ce produse intră** (`rules`):
- filtrele: `categories` și `brands` (oricare din listă, fără litere mari/mici),
  `price_min`/`price_max`, `on_sale` (preț vechi peste cel de acum); un produs trebuie să
  treacă de toate filtrele alese;
- `include`: produse adăugate de mână; `exclude`: produse scoase de mână din ce prind filtrele;
- categoriile și brandurile prind și produsele noi, la fiecare trecere a pilotului.

**Un produs, o singură campanie.** Două campanii pe aceleași produse se licitează între ele
(§1). Ordinea în care grupele își iau produsele: întâi cele lansate (cea lansată mai
devreme are întâietate), apoi ciornele, în ordinea lor. Ce nu e în nicio grupă lansată
rămâne în campania principală. O grupă încheiată nu mai ține nimic; planul ei arată ce ar
prinde dacă o relansezi. Motivele de excludere ale planului (§4) se aplică și grupelor.

**Comanda medie a grupei** = vânzările grupei pe comandă × (totalul comenzii ÷ produse) al
magazinului; fără vânzări, prețul mediu al produselor ei. Din ea ies plafonul pe click,
oprirea de siguranță și bugetul propus, ca la magazin (§5).

**Conversiile din 30 de zile** ale grupei: ce a raportat Google pe produsele ei
(`shopping_performance_view`, toate campaniile Shopping/PMax ale contului) sau, până la
prima trecere a pilotului, comenzile aduse de Google (gclid/UTM) cu produsele ei.

**Treapta**, aleasă de Hontrio din conversii (`campaign_type = auto`, recomandat) sau de om:
- sub 15 conversii în 30 de zile: Shopping standard cu „Maximizează clicurile” (nu are nevoie
  de istoric) și oprire de siguranță; trece singură la PMax când strânge 15 conversii ale ei;
- de la 15: Performance Max fără ROAS țintă;
- PMax ales de om cu puține conversii primește un avertisment: învață greu.

**Bugetul propus** = o cincime din comanda medie a grupei, pe zi.

**Perioada** (opțională, pentru promoții): `starts_on`/`ends_on`, trimise ca
`campaign.start_date_time` / `end_date_time` (`yyyy-MM-dd 00:00:00` / `23:59:59`, în fusul
contului; câmpurile din v26). Google pornește și oprește campania singur. La final, pilotul o
vede `primary_status = ENDED`, o trece „încheiată", iar produsele se întorc în campania
principală. Dacă data e deja trecută și campania tot rulează, pilotul o oprește el.

**Ce oprește lansarea unei grupe:** pașii contului (aceiași ca la campania principală, §1),
grupa fără produse sau fără produse găsite în Merchant Center, fără buget, peste 990 de
produse la PMax (lista de ID-uri), perioada greșită, și campania principală PMax care ar
avea de lăsat afară peste 990 de produse.

**Avertismente:** puține produse, produse care nu pot rula acum, produse negăsite în
Merchant Center, produse prinse deja de altă grupă, PMax cu puține conversii, campania
principală rămasă sub 15 conversii pe lună, bugetele tuturor campaniilor peste bugetul maxim,
buget sub jumătate din cel propus, perioadă sub 14 zile la PMax.

**Lansarea** (`POST /api/campaigns/launch` cu `group_id`): lista de ID-uri a grupei
(`include_items`), aceleași setări ca la campania principală (§3), numele
`Hontrio · {tip} · {grupa} · {magazin} · {data}`. Apoi arborii celorlalte campanii se refac:
campania principală lasă afară produsele grupei, iar un segment vechi pe marje (lista lui e
fixă) le pierde și el.

**Arborii, la fiecare trecere** (`reconcileProducts`): întâi campaniile grupelor (lista lor e
cum o prind regulile acum, fără excluderile planului), apoi celelalte.

**Schimbările pe o grupă lansată ajung pe loc în Google:** produsele (arborii), bugetul
(`set_budget`), sfârșitul perioadei (`end_date_time`). Tipul campaniei și începutul nu se mai schimbă. **Încheierea** oprește campania
(`PAUSED`, „încheiată" în Hontrio) și produsele se întorc în campania principală. Se pot
șterge doar ciornele și grupele încheiate; cifrele campaniilor lor rămân în Rapoarte.

**Limite:** cel mult 5 grupe care rulează sau sunt ciorne în același timp, ca bugetul să nu se
fărâmițeze. Fiecare campanie are nevoie de date; grupele mici vând adesea mai bine rămânând în
campania principală, iar Hontrio o spune înainte de lansare.

**Datele (migrarea 019):** `ad_product_groups` (numele, regulile, obiectivul nefolosit, bugetul, tipul,
perioada, ordinea, starea `draft`/`live`/`ended`, `launched_at`), `ad_campaigns.product_group_id`
(`segment = 'group'`), RPC `commerce_offer_google_sales` (vânzările aduse de Google pe ofertă) și
`ad_product_totals` (cifrele Google pe produs, adunate).

**API:** `POST /api/campaigns/groups` (o ciornă nouă), `PATCH /api/campaigns/groups/{id}`
(schimbări; `{ status: 'ended' }` o încheie), `DELETE /api/campaigns/groups/{id}`; grupele, cu
planul fiecăreia, vin în `GET /api/campaigns/plan`.

## 14. Mai târziu

- **Fusul orar.** Zilele ferestrelor se socotesc acum în UTC, iar `segments.date` vine de la Google
  în fusul contului; perioadele grupelor folosesc fusul magazinului, deși §13 cere fusul contului.
  La conturile din România diferența e de câteva ore; la cele din alte fusuri, „ieri” în UTC poate
  fi încă ziua în curs a contului. De trecut totul pe `customer.time_zone`.
- **Arborele, pe diferență.** Orice schimbare de produse reface acum arborele întreg (scoate toate
  nodurile, pune altele): la un PMax cu 990 de produse, ~2.000 de operații, iar accesul Basic are
  15.000 pe zi pentru toate magazinele. Un arbore Shopping de peste ~5.000 de noduri trece și de
  limita de 10.000 de operații pe cerere. De schimbat doar nodurile care diferă.

## Surse

- Google Ads API: [PMax pentru retail](https://developers.google.com/google-ads/api/performance-max/retail), [crearea campaniei PMax](https://developers.google.com/google-ads/api/performance-max/create-campaign), [materiale](https://developers.google.com/google-ads/api/performance-max/asset-requirements), [grupuri de produse](https://developers.google.com/google-ads/api/performance-max/listing-groups), [criterii PMax](https://developers.google.com/google-ads/api/performance-max/create-campaign-criteria), [Shopping standard](https://developers.google.com/google-ads/api/docs/shopping-ads/create-campaign), [declarația UE](https://developers.google.com/google-ads/api/docs/api-policy/eu-par), [limite](https://developers.google.com/google-ads/api/docs/best-practices/system-limits), [raportare PMax](https://developers.google.com/google-ads/api/performance-max/reporting)
- Definițiile v26: `googleapis/googleapis` → `google/ads/googleads/v26`, exemplul [add_performance_max_retail_campaign.py](https://github.com/googleads/google-ads-python/blob/main/examples/shopping_ads/add_performance_max_retail_campaign.py)
- Merchant API: [surse API suplimentare](https://developers.google.com/merchant/api/guides/data-sources/api-sources), `googleapis/googleapis` → `google/shopping/merchant/{products,datasources,reports}/v1`, [oprirea Content API](https://developers.google.com/shopping-content/guides/deprecation-and-sunset), [specificația produselor](https://support.google.com/merchants/answer/7052112)
- Google Ads Help:
  - campanii: [PMax și celelalte campanii](https://support.google.com/google-ads/answer/13810170), [ROAS țintă](https://support.google.com/google-ads/answer/6268637), [optimizare PMax (6 săptămâni)](https://support.google.com/google-ads/answer/11385582), [cuvinte negative PMax](https://support.google.com/google-ads/answer/15726455)
  - profit: [conversii cu coș](https://support.google.com/google-ads/answer/9028254), [parametrii coșului](https://support.google.com/google-ads/answer/14943675), [exemplul de tag](https://support.google.com/google-ads/answer/14944137)
  - CSS: [lucrul cu CSS](https://support.google.com/merchants/answer/12652686)
- Din piață: [strategia hibridă PMax + Shopping (SEJ, mai 2026)](https://searchenginejournal.com/performance-max-for-ecommerce-the-hybrid-strategy-thats-actually-working/571885/), [AI Max pentru Shopping](https://ppc.land/google-brings-ai-max-to-shopping-campaigns-targeting-conversational-queries/)
