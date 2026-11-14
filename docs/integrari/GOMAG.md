# Conectorul Gomag

Hontrio citește din Gomag produsele și comenzile prin API-ul public
(https://apidocs.gomag.ro, colecția Postman „Gomag Public API"). Doar citire.
Cod: `lib/gomag/` (api, mapping, sync, connect) peste motorul comun
`lib/commerce/paged-sync.ts`. Teste: `tests/gomag.test.ts`.

## Conectarea

- Comerciantul dă **adresa magazinului** și **cheia API** (din panoul Gomag, secțiunea API).
- Cererile merg la `https://api.gomag.ro/api/v1/…`, cu antetele `Apikey` (cheia),
  `ApiShop` (adresa magazinului) și un `User-Agent` al nostru (Gomag refuză agentul Postman).
- La conectare se încearcă adresa scrisă și varianta cu/fără `www.`: Gomag recunoaște
  magazinul doar după adresa lui exactă. Se salvează varianta care a răspuns.
- Verificarea: o pagină de produse, una de comenzi (cheia trebuie să le poată citi pe
  amândouă), monedele. Cheia se salvează criptată (`stores.api_key`).

## Ce răspunde Gomag la erori (văzut pe API-ul real, 14.11.2026)

| Situația | Răspuns |
|---|---|
| Fără antetul `ApiShop` | HTTP 200, `{"error":100,"message":"Missing Api User","data":[]}` |
| Magazin necunoscut sau cheie greșită | HTTP 200, text `Nothing Here! (3)` |
| Agentul Postman | HTTP 500, gol |
| Scrierile reușite | `{"error":"200","status":"200",…}` (deci `error: "200"` nu e o eroare) |

Clientul tratează toate acestea ca erori clare (`sync.gomag_*`); `Nothing Here!` și
`error: 100` înseamnă cheie sau magazin nerecunoscute → magazinul devine „revocat".

## Limitele

„Leaky bucket" pe magazin, implicit **o citire pe secundă**; antetele
`Api-RateLimit-Read` (ritmul) și `Api-RateLimit-Read-Remaining` spun cât merge. Clientul
ține ritmul din antete și așteaptă `Retry-After` la 429. Listele au cel mult 100 de rânduri.

## Maparea

- **Oferta = produsul listat.** La Gomag fiecare variantă e un produs al ei, cu `parent`
  = produsul grupului (un produs simplu e propriul părinte): `offer_id` = id-ul
  produsului, `item_group_id` / `external_product_id` = părintele.
- Doar produsele active (`enabled = 1`) cu preț. Prețul se păstrează **cu TVA**
  (`vat_included = 0` → × (1 + `vat`/100)); `base_price` mai mare = prețul de comparat.
- Disponibil: `stock_status` ≠ `notinstock`, sau „se aduce la comandă"
  (`allowOrdersWhenOutOfStock`). Categoria: ultima din prima ramură.
- **Comenzile**: sumele cu TVA (`price` × cantitate, vouchere ca reducere, `delivery.total`
  ca transport, serviciile ca taxe și linii „extra"); TVA-ul nu vine ca sumă, se
  socotește din cota fiecărui produs, cu reducerea împărțită proporțional.
- Starea: tipul din lista stărilor (`sale` / `return` / `cancel`), altfel numele
  (Comandă nouă, Neplătită → în așteptare; Livrată, Finalizată → finalizată; Returnată →
  rambursată; Anulată → anulată; restul → confirmată). Stările se citesc la fiecare
  trecere completă (`order/status/read`).
- Canalul: `sales_channel` = Website → vitrina (`store`); eMAG, EasySales etc. nu intră
  în vânzările de pe site.
- Țara: Gomag scrie numele („Romania", „Republica Moldova", „Ungaria") → codul ISO
  (`lib/commerce/country.ts`). Din cumpărător nu se păstrează nimic altceva.
- Datele vin fără fus orar („2022-10-24 14:42:21"): se citesc în ora României.

## Sincronizarea

- Completă: produsele, comenzile din ultimele 400 de zile (`startDate`), curățenia
  (ce n-a fost citit se cere după `id`; ce lipsește se șterge). O trecere mare continuă
  la rularea următoare (`stores.sync_cursor`).
- Incrementală (cron): produsele și comenzile cu `updated` de ieri încoace (filtrul se
  trimite ca zi: o zi în plus se recitește, niciuna nu se pierde), comenzile din ultimele
  3 zile, cel mult 25 de produse vândute (se cer câte unul).
- Gomag nu caută comenzile după id: curățenia comenzilor se sare (o comandă Gomag se
  anulează, nu se șterge).

## ⚠ Ce lipsește în API-ul Gomag

**Sursa comenzii** (UTM, gclid) nu există în `order/read`. Deci vânzările aduse de
campaniile Hontrio nu se pot număra din comenzile Gomag, cum se face la WooCommerce,
Shopify, MerchantPro și OpenCart: comenzile Gomag intră fără atribuire
(`platform_data.order_attribution = "unavailable"`). De hotărât: atribuirea din
conversiile Google Ads pentru magazinele Gomag, sau o cerere către Gomag să expună
sursa comenzii în API.

Netestat încă pe un magazin Gomag real (doar pe simularea după documentație): sensul
exact al filtrelor `updated` și `startDate`, răspunsul la un `id` inexistent.
