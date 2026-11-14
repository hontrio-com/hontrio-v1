# Conectorul MerchantPro

Hontrio citește din MerchantPro produsele și comenzile prin API-ul REST v2
(https://docs.merchantpro.com/api/, specificația `/swagger.yml`). Doar citire.
Cod: `lib/merchantpro/` (api, mapping, sync, connect) peste motorul comun
`lib/commerce/paged-sync.ts`. Teste: `tests/merchantpro.test.ts`.

## Conectarea

- Comerciantul face un **utilizator API** (Setări → API și webhooks → API Users, cu
  drept de citire pe produse și comenzi) și dă **domeniul magazinului**, **API User** și
  **API Secret**. Le salvăm criptate (`stores.api_key`, `stores.api_secret`).
- Cererile merg la `https://{domeniu}/api/v2/…`, cu antetul `Authorization: Basic`.
- La conectare: o pagină de produse și una de comenzi. Domeniul fără `www.` care
  trimite la cel cu `www.` (sau invers) se încearcă și în forma cealaltă.
- **O cheie greșită dă 401, iar încercările repetate dau 403** (MerchantPro blochează):
  un 401 nu se reîncearcă niciodată, nici la conectare, nici la sincronizare.

## Limitele

4 cereri/secundă, 80/minut, 3.600/oră, 60.000/zi, plus timpul de server (30 s/minut).
Clientul face o cerere la 0,8 s și pune pauză după antetele `X-RateLimit-Remaining` /
`X-RateLimit-Reset` și `X-RateLimit-Usage-*`; la 429 așteaptă `Retry-After`. O pauză
mai lungă decât timpul rămas oprește rularea, iar trecerea continuă la următoarea.

## Ce se cere

Doar câmpurile folosite (`fields=`): din comenzi **niciun** nume, e-mail, telefon,
adresă, IP sau notă; din adresă doar codul țării. Liniile comenzii vin prin `fields`
(`line_items`).

## Maparea

- **Oferta**: produsul simplu (`basic`, `bundle`) sau fiecare variantă vizibilă a unui
  produs `multi_variant` (`offer_id` = id-ul variantei, `item_group_id` = produsul).
  Produsele digitale și cardurile cadou nu sunt oferte pentru Shopping.
- Doar produsele `status = active`, `visibility = visible`, fără „preț la cerere".
  Prețurile sunt cele cu TVA (`price_gross`); `old_price_gross` mai mare = prețul de
  comparat. Disponibil: `in_stock`.
- **Comenzile**: comenzile „temporare" (plata online neterminată) nu sunt comenzi.
  Starea vine din livrare și plată (anulată / returnată / rambursată / livrată →
  finalizată / în lucru, expediată sau plătită → confirmată / restul în așteptare).
- Sumele: produsele din liniile de produs (cu TVA), transportul (`shipping_amount`, cu
  TVA), totalul; ce lipsește până la total e reducere (cupoane), ce trece de el e taxă.
- **Sursa**: `traffic_source` (structura nu e documentată; doar filtrul `utm_campaign`
  arată că ține UTM-urile) → utm_*, gclid, plus parametrii paginii de intrare, dacă vine;
  `source_type`, originea `source_referrer`, dispozitivul.
- Canalul: comenzile din marketplace-uri (eMAG, Trendyol, Altex…, după `channel_name`) nu
  intră în vânzările de pe site.
- Moneda magazinului: din ultima comandă (API-ul n-are setările magazinului). Țara: cea mai
  des întâlnită în comenzi. Datele vin fără fus orar: se citesc în ora României.

## Sincronizarea

- Completă: produsele active în ordinea creării; comenzile de la cea mai nouă
  (`sort=date_created.desc`), până la începutul ferestrei de 400 de zile (API-ul nu
  filtrează după data plasării); curățenia cere din nou, după `ids`, produsele și
  comenzile necitite (cele dezactivate vin și își pierd ofertele, cele șterse lipsesc).
- Incrementală (cron): produsele și comenzile cu `modified_after` (trimis în ora UTC:
  dacă MerchantPro îl citește ca oră a României, recitim câteva ore în plus), plus
  produsele vândute.
- Un 403 (drept luat) face magazinul „revocat"; după ce omul repară dreptul,
  „Sincronizează acum" îl repune activ, fără reconectare.

Netestat încă pe un magazin MerchantPro real (doar pe simularea după specificație):
structura exactă a `traffic_source`, fusul orar al datelor.
