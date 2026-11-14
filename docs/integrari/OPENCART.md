# Extensia Hontrio pentru OpenCart — contractul API (v1)

API-ul nativ OpenCart (Sistem → Utilizatori → API) e făcut pentru editarea
comenzilor din panou: în nicio versiune (3.0, 4.0, 4.1) nu poate lista produsele
sau comenzile. De aceea Hontrio vine cu o extensie, instalată de comerciant, care:

- expune **doar citire** (produse, comenzi, stările comenzilor, datele magazinului);
- e protejată de o cheie generată în extensie, pe care comerciantul o lipește în Hontrio;
- salvează pe comandă **sursa vizitei** (UTM, gclid / gbraid / wbraid), ca la WooCommerce;
- nu dă nicio dată personală a cumpărătorului (nume, e-mail, telefon, adresă, IP,
  user agent). Din adresă pleacă doar țara (cod ISO).

Versiuni suportate: **OpenCart 3.0.x** (3.0.2.0 – 3.0.5.x) și **OpenCart 4.x**
(4.0.0.0 – 4.1.x). OpenCart 2.x nu e suportat (fără actualizări din 2018).

Sursele extensiei: `integrations/opencart/`. Arhivele de instalat:
`public/downloads/hontrio-opencart-3.ocmod.zip` (OpenCart 3) și
`public/downloads/opencart-4/hontrio.ocmod.zip` (OpenCart 4; vezi 6.1: numele
fișierului e obligatoriu `hontrio.ocmod.zip`), construite cu
`node scripts/build-opencart.mjs`; un test verifică că arhivele corespund surselor.

---

## 1. Adresa și autentificarea

Toate cererile sunt `GET` la aceeași rută, pe toate versiunile:

```
{adresa magazinului}/index.php?route=extension/hontrio/api&action={acțiune}&{parametri}
```

- `{adresa magazinului}` e adresa publică a magazinului (`HTTPS_SERVER` / `config_url`),
  fără `/` la final. Magazinul servit e cel pe care OpenCart îl alege după domeniu
  (`config_store_id`), deci o instalare cu mai multe magazine răspunde pentru
  magazinul de pe domeniul cerut.
- Cheia vine **doar** în antetul `X-Hontrio-Key: {cheie}`. Niciodată în adresă
  (adresele ajung în jurnalele serverelor).
- Cheia: 48 de caractere hexazecimale (`bin2hex(random_bytes(24))`), generată la
  instalarea modulului, regenerabilă din panou. Comparația se face în timp constant
  (`hash_equals`).

## 2. Plicul răspunsului

Răspunsul e JSON (`Content-Type: application/json; charset=utf-8`,
`Cache-Control: no-store`), mereu cu cheia `hontrio_api` **prima**:

```json
{ "hontrio_api": 1, "ok": true, "data": ..., "meta": { ... } }
```

```json
{ "hontrio_api": 1, "ok": false, "error": { "code": "unauthorized", "message": "..." } }
```

`hontrio_api` e versiunea contractului. Clientul caută începutul obiectului după
`{"hontrio_api":` (unele gazde scriu avertismente PHP înaintea răspunsului); extensia
oprește oricum afișarea erorilor pentru cererile ei (`config_error_display = 0`).

| HTTP | `error.code`    | Când |
|------|-----------------|------|
| 401  | `unauthorized`  | lipsește antetul sau cheia nu se potrivește |
| 403  | `disabled`      | API-ul e oprit din panoul extensiei |
| 400  | `bad_request`   | acțiune necunoscută sau parametru invalid (`message` spune care) |
| 500  | `server_error`  | excepție la citire (`message` fără detalii de server) |

Numerele sunt numere JSON (nu șiruri). Datele sunt ISO 8601 **cu fusul orar**
(`2026-11-14T15:04:05+02:00`), în fusul în care rulează magazinul. Lipsa unei
valori e `null`, nu `""`.

Parametrii comuni ai listelor: `page` (≥ 1, implicit 1) și `limit` (implicit și
maxim diferă pe acțiune). `meta` = `{ "page", "limit", "total", "pages" }`.
Listele sunt ordonate crescător după id: paginile nu se amestecă dacă apar
produse sau comenzi noi în timpul citirii.

## 3. Acțiuni

### 3.1 `info`

Datele magazinului și ale extensiei. Hontrio o cheamă la conectare (verifică cheia)
și la fiecare trecere completă.

```json
{
  "extension_version": "1.0.0",
  "opencart_version": "3.0.4.1",
  "php_version": "8.2.12",
  "store": {
    "id": 0,
    "name": "Magazinul meu",
    "url": "https://magazin.ro",
    "country": "RO",
    "language": "ro",
    "currency": "RON",
    "timezone": "Europe/Bucharest",
    "prices_include_tax": true,
    "customer_group_id": 1
  },
  "counts": { "products": 120, "orders": 3400 },
  "statuses": [
    { "id": 1, "name": "Pending", "processing": false, "complete": false },
    { "id": 5, "name": "Complete", "processing": false, "complete": true }
  ],
  "extensions": { "feed": ["google_base"], "analytics": ["google"], "module": ["hontrio"] },
  "tracking": { "enabled": true, "since": "2026-11-14T10:00:00+02:00" },
  "server_time": "2026-11-14T15:04:05+02:00"
}
```

- `store.country`: `iso_code_2` al țării magazinului (`config_country_id`).
- `store.language`: codul limbii implicite a magazinului, doar partea de limbă (`ro-ro` → `ro`).
- `store.currency`: moneda implicită (`config_currency`). **Toate sumele** din
  produse și comenzi sunt în ea (așa le ține OpenCart).
- `store.timezone`: `date_default_timezone_get()` (OpenCart 4 îl ia din `config_timezone`).
- `store.prices_include_tax`: `config_tax` (prețurile se afișează cu taxe).
- `counts.products`: produsele listate (vezi 3.2); `counts.orders`: comenzile cu `order_status_id > 0`.
- `statuses`: toate stările comenzilor, în limba implicită a magazinului; `processing`
  și `complete` spun dacă id-ul e în `config_processing_status` / `config_complete_status`.
- `extensions`: codurile extensiilor **instalate și pornite** de tip feed, analytics și
  module (ca Hontrio să vadă dacă există un feed Google sau o etichetă de conversie).
- `tracking.enabled`: salvarea sursei e pornită; `since`: de când (data instalării sau a
  ultimei porniri), ca Hontrio să știe de la ce dată comenzile pot avea sursă.

### 3.2 `products`

Parametri: `page`, `limit` (1–250, implicit 100), opțional `modified_after` (ISO 8601),
opțional `ids` (listă de id-uri separate prin virgulă, cel mult 250).

Doar produsele **listate** în magazinul cerut, exact ca vitrina: `status = 1`,
`date_available <= azi`, legate de `config_store_id` în `product_to_store`.
Cu `ids`, cele care nu sunt listate lipsesc din răspuns (așa află Hontrio că au dispărut).
Cu `modified_after`, doar cele cu `date_modified >= modified_after`.

```json
{
  "product_id": 42,
  "master_id": 0,
  "variant": null,
  "name": "Lampă de birou Nordic",
  "model": "LMP-42",
  "sku": "LMP-42-NEGRU",
  "upc": null, "ean": "5941234567890", "jan": null, "isbn": null, "mpn": null,
  "url": "https://magazin.ro/lampa-de-birou-nordic",
  "image": "https://magazin.ro/image/catalog/lampa.jpg",
  "manufacturer": "Nordic",
  "categories": [["Iluminat", "Lămpi de birou"], ["Promoții"]],
  "price": 121.0,
  "price_net": 100.0,
  "regular_price": 145.2,
  "regular_price_net": 120.0,
  "special_ends": "2026-12-01",
  "tax_rate": 21.0,
  "quantity": 7,
  "subtract": true,
  "available": true,
  "stock_status": null,
  "date_added": "2025-02-01T09:00:00+02:00",
  "date_modified": "2026-11-10T12:30:00+02:00"
}
```

- `master_id` / `variant`: în OpenCart 4, o variantă e un produs cu `master_id` > 0;
  `variant` = opțiunile care o definesc, ca listă `[{ "name": "Culoare", "value": "Negru" }]`
  (din `variant` + numele opțiunilor). În OpenCart 3 sunt mereu `0` / `null`.
- `url`: linkul produsului cum îl face magazinul (`$this->url->link('product/product', 'product_id=…')`,
  deci adresa SEO când e pornită), absolut, fără `&amp;`.
- `image`: imaginea principală, originalul (`{url}/image/{image}`), fără redimensionare
  (ca extensia să nu scrie fișiere în cache); `null` dacă lipsește.
- `categories`: căile categoriilor produsului din magazinul cerut, de la rădăcină la frunză,
  în limba implicită (din `category_path`). Ordinea: după `category_id`.
- `price` / `price_net`: prețul pe care îl plătește un vizitator neautentificat
  (grupul implicit de clienți) pentru o bucată: specialul activ dacă există, altfel
  reducerea de cantitate 1, altfel prețul produsului. `price_net` e fără taxe;
  `price` = cu taxele clasei de taxe la adresa implicită a magazinului (`$this->tax->calculate(…, true)`),
  oricare ar fi `config_tax` (Google cere prețul cu TVA).
- `regular_price` / `regular_price_net`: prețul fără special (doar când e mai mare
  decât `price`; altfel `null`). `special_ends`: `date_end` al specialului (sau `null`).
- `tax_rate`: cota procentuală efectivă la adresa implicită (`(price / price_net − 1) × 100`,
  rotunjită la 2 zecimale); `0` fără clasă de taxe.
- `quantity` / `subtract`: stocul și dacă se scade la vânzare.
- `available`: se poate cumpăra acum (`quantity > 0` sau `config_stock_checkout = 1`).
- `stock_status`: numele stării de stoc afișate când `quantity <= 0` (ex. „Pre-Order”), altfel `null`.

### 3.3 `product_ids`

Parametri: `page`, `limit` (1–5000, implicit 5000). `data` = id-urile produselor
listate (aceeași regulă ca la 3.2), ca numere. Folosită la curățenie: ce are Hontrio și
nu mai e în listă s-a șters sau nu mai e de vânzare.

### 3.4 `orders`

Parametri: `page`, `limit` (1–100, implicit 50), opțional `created_after`,
`modified_after` (ISO 8601), `ids` (cel mult 100).

Doar comenzile reale (`order_status_id > 0`; 0 = coș abandonat la plată) ale
magazinului cerut (`store_id = config_store_id`).

```json
{
  "order_id": 1001,
  "invoice": "INV-2026-00012",
  "status_id": 5,
  "status": "Complete",
  "date_added": "2026-11-12T10:15:00+02:00",
  "date_modified": "2026-11-13T09:00:00+02:00",
  "currency": "RON",
  "currency_code": "EUR",
  "currency_value": 0.2,
  "total": 245.5,
  "totals": [
    { "code": "sub_total", "title": "Sub-Total", "value": 200.0 },
    { "code": "shipping", "title": "Curier", "value": 15.0 },
    { "code": "coupon", "title": "Cupon (TOAMNA10)", "value": -10.0 },
    { "code": "tax", "title": "TVA 21%", "value": 40.5 },
    { "code": "total", "title": "Total", "value": 245.5 }
  ],
  "payment_method": "Plata la livrare",
  "payment_code": "cod",
  "shipping_method": "Curier",
  "country": "RO",
  "coupon": "TOAMNA10",
  "marketing_id": 0,
  "tracking": null,
  "products": [
    {
      "order_product_id": 7, "product_id": 42, "master_id": 0,
      "name": "Lampă de birou Nordic", "model": "LMP-42", "quantity": 2,
      "price": 100.0, "tax": 21.0, "total": 200.0,
      "options": [{ "name": "Culoare", "value": "Negru" }]
    }
  ],
  "source": {
    "utm_source": "google", "utm_medium": "cpc", "utm_campaign": "hontrio-123",
    "utm_term": null, "utm_content": null,
    "gclid": "Cj0KCQ…", "gbraid": null, "wbraid": null,
    "referrer": "https://www.google.com",
    "landing_path": "/lampa-de-birou-nordic",
    "captured_at": "2026-11-12T10:02:11+02:00"
  }
}
```

- `currency`: moneda implicită a magazinului; **toate sumele** (`total`, `totals`,
  `products`) sunt în ea, cum le ține OpenCart. `currency_code` / `currency_value`:
  moneda în care a plătit clientul și cursul ei față de cea implicită.
- `totals`: rândurile din `order_total`, în ordinea `sort_order`, cu titlul lor.
- `products[].price` și `products[].tax`: pe bucată, fără taxe și taxa pe bucată
  (cum le ține `order_product`); `total` = `price × quantity`, fără taxe.
  `options`: opțiunile alese (`order_option`: nume și valoare).
- `country`: `iso_code_2` al țării de facturare, altfel al celei de livrare, altfel `null`.
- `coupon`: codul cuponului folosit (din `coupon_history`), altfel `null`.
- `marketing_id` / `tracking`: legătura de marketing a OpenCart (Marketing → Tracking) și
  codul de afiliere, cum sunt pe comandă (`tracking` gol → `null`).
- `source`: sursa salvată de extensie la plasarea comenzii (vezi 4), sau `null`
  (comandă dinaintea instalării, din panou, sau vizită fără parametri).

### 3.5 `order_ids`

Parametri: `page`, `limit` (1–5000, implicit 5000), opțional `created_after`.
`data` = id-urile comenzilor reale (aceeași regulă ca la 3.4). Folosită la curățenie.

## 4. Sursa vizitei (atribuirea)

Cu `tracking` pornit (implicit):

1. La fiecare pagină a vitrinei (evenimentul înaintea `common/header`), dacă adresa are
   cel puțin unul dintre `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`,
   `utm_content`, `gclid`, `gbraid`, `wbraid`, extensia pune în **sesiunea OpenCart**
   (nu un cookie nou) valorile lor (cel mult 200 de caractere fiecare), originea
   paginii de proveniență (`HTTP_REFERER`, doar `https://domeniu`), calea paginii de
   intrare (fără parametri) și momentul. O vizită nouă cu parametri o înlocuiește
   (ultimul clic).
2. După `addOrder` (și `editOrder`, dacă comanda nu are încă sursă), extensia salvează
   sursa din sesiune în tabelul `{prefix}hontrio_order_source` (`order_id` cheie primară).

Evenimentele (codul `hontrio`) se înregistrează la instalarea modulului și se șterg
la dezinstalare, cu tabelul și setările.

## 5. Panoul extensiei (Extensii → Module → Hontrio)

- Cheia, cu buton de copiere și „Generează o cheie nouă” (cea veche nu mai merge).
- „API pornit” (implicit da) și „Salvează sursa comenzilor” (implicit da).
- Pașii de conectare în Hontrio și linkul spre Hontrio.
- Limbile: engleză (`en-gb`) și română (`ro-ro`).

## 6. Clarificări (verificate pe OpenCart 3.0.4.1, 3.0.5.0, 4.0.2.3, 4.1.0.4)

Adăugate după implementare; nu schimbă nicio cheie sau formă de mai sus.

### 6.1 Arhivele și numele lor

- OpenCart 4 face codul extensiei din **numele fișierului** urcat
  (`basename(…, '.ocmod.zip')` → dosarul `extension/{cod}/`). Arhiva pentru 4 se
  numește deci `hontrio.ocmod.zip` și stă în `public/downloads/opencart-4/`. Urcată cu
  alt nume (de exemplu `hontrio (1).ocmod.zip`, după o a doua descărcare), extensia
  nu merge. OpenCart 3 acceptă orice nume care se termină în `.ocmod.zip`.
- Arhivele sunt necomprimate (STORE), cu rânduri LF și aceeași dată pentru toate
  intrările: sunt aceleași octeți pe orice calculator.

### 6.2 Când răspunsul nu e JSON-ul extensiei

- Modulul dezinstalat, dar fișierele încă pe server: OpenCart 3 răspunde
  `403 disabled`; **OpenCart 4 nu încarcă extensiile neinstalate** și răspunde cu
  pagina lui „Pagina nu a fost găsită” (HTML, fără `{"hontrio_api":`).
- Fișierele scoase (sau o adresă care nu e OpenCart): pagina magazinului, fără JSON.
- Modul mentenanță pornit: pagina de mentenanță a OpenCart, fără JSON.
- Baza de date a magazinului indisponibilă: eroarea OpenCart (HTML, 200 sau 500), fără JSON.

Clientul tratează orice răspuns fără `{"hontrio_api":` ca „extensia nu e instalată
sau magazinul nu e accesibil”.

### 6.3 Câmpuri

- Sumele sunt rotunjite la 4 zecimale (cât ține OpenCart). `price` poate avea mai
  mult de 2 zecimale (exemplu demo: 279,99 + 20% + taxa fixă 2 = `337.988`); clientul
  rotunjește la precizia monedei.
- `tax_rate` include și taxele fixe ale clasei (exemplu demo: TVA 20% + „Eco Tax” 2 la
  un preț de 100 → `22.0`).
- `products[].price_net` / `regular_price_net`: când reducerea de cantitate 1 e
  prețul vitrinei, ea e `price_net`, iar `regular_price` rămâne `null` (vitrina nu
  arată preț tăiat). Un special activ bate reducerea: `regular_price_net` e atunci
  prețul cu reducere, nu prețul de bază.
- `variant`: doar opțiunile **fixate** de variantă (cele bifate la „override” în
  formularul variantei); celelalte valori din coloana `variant` sunt doar implicite
  ale formularului și nu definesc varianta.
- OpenCart 4.1 ține codurile (SKU, UPC, EAN, JAN, ISBN, MPN) în `product_code`;
  extensia le citește de acolo, cu aceleași chei ca în 3.0 / 4.0.
- `payment_code`: OpenCart 3 dă codul extensiei (`cod`), OpenCart 4.0.2+ codul
  metodei (`cod.cod`). `shipping_method` e numele metodei, pe toate versiunile.
- `coupon`: din `coupon_history`; o comandă rămasă într-o stare care nu e „în
  procesare” sau „finalizată” nu are încă rând acolo, așa că extensia ia codul din
  paranteza de la sfârșitul titlului totalului `coupon` („Coupon (TOAMNA10)”).
- `info.tracking.since` e `null` când salvarea sursei e oprită; la repornire primește
  data repornirii.
- `store.url` vine din `config_url` (OpenCart 3: `config_ssl` când `config_secure` e pornit).
- `store.currency` și `currency` din comenzi: moneda implicită a **instalării**
  (`config_currency` al magazinului 0, cea cu cursul 1), în care OpenCart ține toate
  sumele. Un magazin secundar care afișează altă monedă (de exemplu EUR) are tot sumele
  în ea; verificat cu un al doilea magazin pe alt domeniu.
- Într-o instalare cu mai multe magazine, `price` (cu taxe) e calculat pentru adresa
  implicită a magazinului cerut: același produs poate avea `price_net` egal și `price`
  diferit între magazine din țări diferite.

### 6.4 Parametri

- `limit` în afara intervalului dă `400` (nu se taie în tăcere la maxim).
- `ids` se aplică înaintea paginării: `page` / `limit` / `meta` sunt ale listei filtrate.
- O dată fără fus orar (`2026-11-14` sau `2026-11-14T10:00:00`) e în fusul
  magazinului; una cu fus (`Z`, `+02:00`) se convertește în el. O dată invalidă
  (`2026-02-30`) dă `400`.

### 6.5 Sursa vizitei

- Sursa stă în sesiunea OpenCart: o comandă plasată mai târziu în aceeași sesiune, fără
  parametri noi, primește tot sursa ultimului clic. O sesiune nouă fără parametri → `null`.
- Ultimul clic înlocuiește **toată** sursa (un `gclid` vechi nu rămâne lângă UTM-urile noi).
- `landing_path` e calea cerută: `/index.php` fără adrese SEO, `/iphone` (3.x) sau
  `/en-gb/product/iphone` (4.x) cu adrese SEO.
- Evenimentele de model se înregistrează în ambele forme (`checkout/order/addOrder`
  pentru 4.0, `checkout/order.addOrder` pentru 4.1); acțiunile folosesc separatorul
  versiunii (`|` până la 4.0.1.x, `.` de la 4.0.2.0).

### 6.6 Actualizarea extensiei

- OpenCart 3: noua arhivă urcată peste cea veche păstrează cheia, setările și sursele.
- OpenCart 4: Installer-ul nu scoate fișierele unui modul instalat; actualizarea
  cere dezinstalarea modulului (cheie nouă, tabelul sursei șters) și reinstalarea.
