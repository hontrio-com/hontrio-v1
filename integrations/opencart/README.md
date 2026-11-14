# Extensia Hontrio pentru OpenCart

Extensia îi dă lui Hontrio acces **doar de citire** la produsele și comenzile
magazinului (fără date de identificare a cumpărătorilor) și salvează pe fiecare
comandă nouă sursa vizitei (UTM, gclid / gbraid / wbraid). Contractul API:
[docs/integrari/OPENCART.md](../../docs/integrari/OPENCART.md).

Versiuni verificate: OpenCart **3.0.4.1, 3.0.5.0, 4.0.2.3, 4.1.0.4** (PHP 8.2).
Codul pentru OpenCart 3 e scris pentru PHP 7.3+.

## Sursele

```
shared/core.php          miezul (API-ul, sursa vizitei), același pentru 3 și 4
oc3/upload/...           OpenCart 3.0.x: controlerele, panoul, limbile (en-gb, ro-ro)
oc4/...                  OpenCart 4.x: install.json, admin/, catalog/
tests/contract.mjs       verificarea unui magazin viu față de contract
```

Arhivele se construiesc din surse (deterministe, testate de `npm test`):

```
node scripts/build-opencart.mjs            # scrie arhivele
node scripts/build-opencart.mjs --check    # doar verifică
```

| Versiune     | Fișier                                          |
|--------------|-------------------------------------------------|
| OpenCart 3.x | `public/downloads/hontrio-opencart-3.ocmod.zip` |
| OpenCart 4.x | `public/downloads/opencart-4/hontrio.ocmod.zip` |

⚠ OpenCart 4 face codul extensiei din **numele fișierului** urcat: arhiva trebuie
urcată exact ca `hontrio.ocmod.zip` (nu `hontrio (1).ocmod.zip`, cum o redenumește
browserul la a doua descărcare).

## Instalarea, pentru comerciant

**OpenCart 3.0.x**

1. Extensii → Installer → Încarcă → `hontrio-opencart-3.ocmod.zip`.
2. Extensii → Extensii → tipul „Module” → Hontrio → Instalează (butonul verde).
3. Hontrio → Editează: copiază cheia.
4. În Hontrio: Setări → Integrări → OpenCart: adresa magazinului și cheia.

**OpenCart 4.x**

1. Extensii → Installer → Încarcă → `hontrio.ocmod.zip`, apoi Instalează pe rândul Hontrio.
2. Extensii → Extensii → tipul „Module” → Hontrio → Instalează.
3. Hontrio → Editează: copiază cheia.
4. În Hontrio: Setări → Integrări → OpenCart: adresa magazinului și cheia.

Din pagina Hontrio a panoului se poate genera o cheie nouă (cea veche nu mai
merge), opri API-ul și opri salvarea sursei comenzilor.

**Dezinstalarea:** Extensii → Module → Hontrio → Dezinstalează șterge cheia,
setările, evenimentele și tabelul `{prefix}hontrio_order_source`. Fișierele se scot
din Installer (OpenCart 4: Dezinstalează pe rândul Hontrio).

**Actualizarea:** OpenCart 3 — urci noua arhivă peste cea veche; cheia, setările
și sursele salvate rămân (verificat). OpenCart 4 — Installer-ul nu scoate fișierele
unui modul instalat, deci actualizarea înseamnă: dezinstalezi modulul, apoi fișierele,
ștergi arhiva veche, urci și instalezi arhiva nouă și modulul. Cheia se schimbă (o
lipești din nou în Hontrio), iar sursele salvate până atunci se șterg odată cu tabelul;
Hontrio le are deja din sincronizările anterioare.

## Testele

`npm test` (tests/opencart-extension.test.ts): arhivele corespund surselor,
structura cerută de Installer-ul fiecărei versiuni, cod compatibil PHP 7.3 pentru
OpenCart 3, nicio coloană cu date de identificare citită din comenzi, `php -l`
pe toate fișierele (dacă PHP e instalat; altfel `PHP_BIN=...`).

Pe un magazin viu (oricare versiune):

```
node integrations/opencart/tests/contract.mjs https://magazin.ro <cheie>
node integrations/opencart/tests/contract.mjs https://magazin.ro <cheie> --expect-disabled   # cu API-ul oprit din panou
```

### Magazine OpenCart locale (Windows, XAMPP)

Rețeta folosită la verificare (PHP 8.2 și MariaDB 10.4 din XAMPP, izolate de
datele XAMPP):

1. MariaDB separat: `mysql_install_db.exe --datadir=<dosar> --port=3307 --password=<parolă>`,
   pornit cu un `my.ini` propriu (`port=3307`, `bind-address=127.0.0.1`).
2. Câte o bază pe magazin; din arhiva oficială (github.com/opencart/opencart/releases)
   se copiază `upload/`, `config-dist.php` → `config.php` (și în `admin/`), apoi
   `php install/cli_install.php install --db_hostname 127.0.0.1 --db_port 3307 ... --http_server http://127.0.0.1:<port>/`
   și se redenumește dosarul `install/`.
3. Serverul PHP încorporat, cu un router care imită `.htaccess` (adresele SEO):
   `php -S 127.0.0.1:<port> -t <magazin> router.php`. E-mailurile comenzilor merg la
   un SMTP local care le aruncă (`-d SMTP=127.0.0.1 -d smtp_port=2525`), ca `mail()`
   să nu lase avertismente.
4. Extensia se urcă din panou (Installer), ca la un comerciant, apoi `contract.mjs`.

## Limitări cunoscute

- **Mod mentenanță:** OpenCart răspunde cu pagina de mentenanță oricărei cereri care
  nu vine de la un administrator; API-ul nu e disponibil cât timp e pornit.
- **Modul dezinstalat, fișiere rămase:** OpenCart 3 răspunde `403 disabled`;
  OpenCart 4 nu încarcă extensiile neinstalate și răspunde cu pagina lui „Pagina
  nu a fost găsită” (fără JSON).
- **Antetul `X-Hontrio-Key`** trebuie să ajungă la PHP; un proxy care taie antetele
  necunoscute face orice cerere `401`.
- Fiecare cerere a API-ului pornește o sesiune OpenCart (așa merge vitrina);
  OpenCart le curăță singur.
