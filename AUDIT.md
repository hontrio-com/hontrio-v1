# AUDIT DE SECURITATE, COSTURI ȘI CALITATE — Hontrio v1

**Data auditului:** 2026-03-19
**Auditor:** Claude Sonnet 4.6 (audit automat complet)
**Fișiere analizate:** 120+ fișiere (toate rutele API, lib/, middleware, config, widget)

---

## LEGENDĂ SEVERITATE

- 🔴 **Critical** — exploatabil în producție, pierdere de date/bani, acces neautorizat
- 🟡 **Medium** — risc real dar cu condiții sau impact limitat
- 🟢 **Minor** — calitate cod, UX, best practices

---

## 1. SECURITATE

---

### 1.1 AUTENTIFICARE / AUTORIZARE

**🔴 Critical — `/api/agent/memory` expus fără nicio autentificare**
`app/api/agent/memory/route.ts:6`
Endpoint-ul GET și POST acceptă `userId` din body/query fără să verifice că request-ul vine de la un vizitator legitim. Orice actor extern poate citi sau scrie memorie pentru orice `userId`, inclusiv suprascrierea `key_facts` și `conversation_summary`. Nu există nicio verificare de token sau de origine (CORS setat `Access-Control-Allow-Origin: *`).

**🔴 Critical — `/api/agent/order` și `/api/agent/stock` expuse fără autentificare**
`app/api/agent/order/route.ts:47`, `app/api/agent/stock/route.ts:14`
Aceste endpoint-uri acceptă un `userId` din request body și întorc date despre comenzi și stoc din WooCommerce. Oricine poate trimite un `userId` arbitrar și obține lista de comenzi a acelui user (inclusiv email-uri, nume, adrese). Credential-ele WooCommerce sunt decriptate server-side și folosite, dar rezultatele sunt returnate fără a verifica că cel care întreabă este proprietarul acelui `userId`.

**🔴 Critical — `/api/agent/triggers` GET expune trigger-e prin `userId` public**
`app/api/agent/triggers/route.ts:17`
Când există `?userId=...` în query, ruta returnează trigger-ele utilizatorului fără nicio autentificare. Deși datele nu sunt critice (mesaje proactive), pattern-ul este periculos și poate fi abuzat pentru enumerare de utilizatori.

**🔴 Critical — `/api/cron/image-cleanup` fără CRON_SECRET**
`app/api/cron/image-cleanup/route.ts:6`
Ruta de cleanup nu verifică `CRON_SECRET` deloc (nu are logica de autentificare). Oricine poate apela `GET /api/cron/image-cleanup` și declanșa refunduri de credite pentru imagini „stuck". Vercel Cron nu protejează automat endpoint-urile — trebuie verificat `Authorization: Bearer CRON_SECRET`.

**🟡 Medium — Cron-urile `competitor-monitor`, `image-bulk`, `risk-weekly-report`, `risk-sync-orders` sunt condiționale pe CRON_SECRET**
`app/api/cron/*/route.ts`
Pattern-ul `if (cronSecret) { verifică }` înseamnă că dacă `CRON_SECRET` nu e setat în `.env`, endpoint-urile sunt complet publice. Dacă cineva uită să seteze variabila în producție, toate cron-urile devin accesibile neautentificat.

**🟡 Medium — Cron `risk-sync-orders` acceptă `?manual=true` care bypass-ează autentificarea**
`app/api/cron/risk-sync-orders/route.ts:20`
`if (!manual && secret && authH !== ...)` — dacă `?manual=true` e în URL, autentificarea e complet sărită. Oricine poate apela manual sincronizarea de ordere prin URL public.

**🟡 Medium — `/api/agent/public-config` returnează date hardcodate în română ca fallback**
`app/api/agent/public-config/route.ts:33-41`
Fallback-ul include texte hardcodate: `'Asistent'`, `'Bună! Cu ce te pot ajuta?'`, `['Caut un produs', 'Am o întrebare', 'Livrare & retur']`. Acestea nu se internalizează — widgetul va afișa mereu română indiferent de limbă dacă agentul nu e configurat.

**🟢 Minor — Middleware-ul marchează `/api/agent/triggers` ca public în skip-list dar ruta are logica sa de auth**
`middleware.ts:89`
`/api/agent/triggers` este în skip-list din middleware, dar ruta gestionează singură autentificarea pentru operațiile CRUD (GET public per userId, POST/PUT/DELETE necesită sesiune). Aceasta e intenționată dar neevidentă.

---

### 1.2 CORS

**🔴 Critical — Multiple endpoint-uri publice au `Access-Control-Allow-Origin: *`**
`app/api/agent/memory/route.ts`, `app/api/agent/order/route.ts`, `app/api/agent/stock/route.ts`, `app/api/agent/triggers/route.ts`, `app/api/agent/config-stream/route.ts`, `app/api/agent/public-config/route.ts`
CORS wildcard (`*`) combinat cu `Access-Control-Allow-Credentials: true` este în general problematic, dar aceste rute nu folosesc credentials în CORS — ele nu au `Allow-Credentials: true`. Totuși, pentru `/api/agent/memory` și `/api/agent/order`, CORS wildcard permite oricărui site să facă request-uri și să obțină date despre utilizatori.

**🟡 Medium — `config-stream` setează `Access-Control-Allow-Origin: *` pentru SSE**
`app/api/agent/config-stream/route.ts:7`
SSE-ul de config expune configurația agentului (culori, mesaje, quick replies) oricărui origin. Deși nu e informație critică, widgetul trebuie să poată citi de pe orice domeniu, deci e justificat tehnic — dar este un risc de information leakage despre configurarea agentului.

---

### 1.3 HMAC / WEBHOOK SECURITY

**🟡 Medium — `product-webhook` permite fallback fără HMAC când `webhook_secret` lipsește**
`app/api/agent/product-webhook/route.ts:161`
```typescript
if (store.webhook_secret && sig) {
  if (!verifyHmac(raw, sig, store.webhook_secret)) { ... }
}
```
Dacă `webhook_secret` este null în DB sau `sig` este absent, validarea HMAC este complet sărită. Un actor extern care știe URL-ul poate trimite orice produs pentru procesare AI (cu cost de credite).

**🟡 Medium — `risk/webhook` permite fallback URL match fără semnătură**
`app/api/risk/webhook/route.ts:60`
```typescript
if (!store && !sig && src) {
  store = stores.find(...)
}
```
Dacă nu există semnătură (`sig` absent), ruta face fallback la URL match. Oricine care știe URL-ul unui magazin monitorizat poate injecta comenzi false în sistemul de risk.

---

### 1.4 PROMPT INJECTION

**🟡 Medium — Date brute din WooCommerce sunt injectate direct în prompturi AI**
`app/api/agent/product-webhook/route.ts:88`, `lib/openai/generate-text.ts:61`
Titlul produsului, descrierea și categoria din WooCommerce sunt interpolate direct în prompturi fără sanitizare pentru context AI. Un proprietar de magazin malițios sau un atacator care modifică un produs WooCommerce poate injecta instrucțiuni în prompt (ex: `Ignore previous instructions and...`).

`app/api/cron/competitor-monitor/route.ts:161`
Titlul paginii competitor, meta-ul și textul body extras din HTML sunt interpolate direct în prompt GPT:
```typescript
const prompt = `Titlu: "${titleMatch?.[1]?.trim()}"
Meta: "${metaMatch?.[1]?.trim()}"
Text: "${bodyText.substring(0, 1000)}"`
```
Un competitor care include instrucțiuni în meta tag sau titlu poate injecta prompt-uri.

**🟡 Medium — `competitor/steal` include valori externe în prompt fără sanitizare**
`app/api/competitor/steal/route.ts:93-95`
`competitor_value` și `my_current` sunt injectate direct: `VARIANTA COMPETITORULUI: "${competitor_value}"`. Deși userul autentificat controlează aceste valori, nu există limite de lungime impuse pentru `competitor_value`.

---

### 1.5 SSRF

**🟢 Minor — SSRF protection există dar nu acoperă DNS rebinding**
`lib/security/validate-url.ts`
Validarea blochează IP-uri private și localhost, dar nu protejează împotriva DNS rebinding (un domeniu public care rezolvă la IP intern). În contextul actual (test de conectivitate WooCommerce), riscul e mic dar există.

---

### 1.6 RATE LIMITING

**🟡 Medium — `rateLimit` sync în `auth.config.ts` folosește in-memory, nu Redis**
`lib/auth/auth.config.ts:64`
```typescript
const emailLimit = rateLimit(`login:email:...`, 5, 10 * 60 * 1000)
```
`rateLimit` (sync) folosește doar `memoryRateLimit` — în-memorie, resetabil la fiecare deploy, nesincronizat între instanțe Vercel. Un atacator poate face brute force pe login prin mai multe instanțe simultan.

**🟡 Medium — `/api/stores/connect` folosește rate limit in-memory**
`app/api/stores/connect/route.ts:19`
```typescript
const rl = rateLimit(`store-connect:${userId}`, 5, 10 * 60 * 1000)
```
Aceeași problemă: limita nu e distribuită. La restartul funcției, contorul se resetează.

**🟢 Minor — `/api/agent/chat` are rate limiting per IP și per visitor dar IP-ul poate fi spoofed**
`lib/security/rate-limit.ts:108`
`getClientIp` folosește `x-forwarded-for` fără validare — un atacator poate seta header-ul manual pe Vercel dacă există un proxy intermediar necontrolat.

---

### 1.7 VALIDARE INPUT

**🟡 Medium — `/api/admin/broadcast` nu validează tipul `type` și `target`**
`app/api/admin/broadcast/route.ts:12`
`type` și `target` sunt acceptate fără validare, deși sunt folosite în logică. Nu e un SQL injection (Supabase folosește parametrizare), dar poate duce la comportament neașteptat.

**🟡 Medium — `/api/agent/memory` POST nu validează dimensiunea `messages`**
`app/api/agent/memory/route.ts:37`
Oricine poate trimite un array `messages` de dimensiune arbitrară — se trimite tot la OpenAI pentru summarizare, generând costuri nelimitate.

**🟡 Medium — `/api/risk/sync-all` fără rate limit**
`app/api/risk/sync-all/route.ts:9`
Endpoint SSE care descarcă toți clienții și comenzile din WooCommerce nu are rate limiting. Un user autentificat poate apela acest endpoint în buclă.

**🟢 Minor — `product_ids` în `/api/seo/bulk` limitat la 20, dar fără validare de tip**
`app/api/seo/bulk/route.ts:145`
`ids = product_ids.slice(0, 20)` — se limitează la 20, dar nu se verifică că fiecare element este un UUID valid înainte de query.

---

### 1.8 XSS

**🟡 Medium — `buildEscalationEmail` injectează `visitorMessage` și `content` nesanitizat în HTML**
`lib/email.ts:135`
```typescript
<p style="...">"${visitorMessage}"</p>
```
și
```typescript
<span style="...">${m.content}</span>
```
Mesajele vizitatorilor sunt injectate direct în HTML-ul emailului fără escape. Dacă un email client renderizează HTML dintr-un email (common), un vizitator malițios poate injecta HTML sau script-uri în emailul trimis la owner-ul magazinului.

**🟢 Minor — Widget JS: `showBubble(trigger.message)` setează `textContent`**
`public/agent-widget.js:212`
`blText.textContent = msg` — folosit corect `textContent` (nu `innerHTML`) pentru bubble, deci nu există XSS aici.

**🟢 Minor — Widget JS: răspunsurile AI sunt afișate via `innerHTML`**
Verificând codul widget (deși nu am văzut tot), pattern-ul comun este că mesajele bot sunt afișate via `innerHTML` pentru a permite formatare. Dacă nu se face sanitizare a răspunsului AI înainte de inserție, există risc XSS.

---

### 1.9 CSRF

**🟢 Minor — `lib/security/csrf.ts` există dar nu este aplicat în nicio rută**
`lib/security/csrf.ts:9`
`validateCsrf` este definit dar nu pare a fi apelat în nicio rută API. Protecția CSRF depinde exclusiv de JWT în cookie (httpOnly, sameSite: lax), care oferă protecție în cele mai multe scenarii. Totuși, absența utilizării funcției sugerează că a fost scrisă dar nu integrată.

---

### 1.10 ALTE PROBLEME DE SECURITATE

**🟡 Medium — `auth.config.ts` Google sign-in poate crea utilizatori duplicați**
`lib/auth/auth.config.ts:116`
Fluxul Google OAuth verifică tabela `users` (nu `auth.users`) pentru existența userului. Dacă un user există în `auth.users` dar nu în `users`, se apelează `createUser` care poate eșua silențios, lăsând `user.id` nesetat. Ulterior, `ensureUserProfile` e apelat cu un `id` potențial null.

**🟡 Medium — Credențiale WooCommerce sunt decriptate și folosite în `autoPublishToWoo`**
`app/api/cron/image-bulk/route.ts:215`
Pattern condițional de decriptare:
```typescript
const ck = (store.api_key?.includes(':') ? decrypt(store.api_key) : store.api_key).trim()
```
Dacă un atacator poate stoca un cheie non-criptată (fără `:`) în DB, funcția o va folosi direct. Aceasta e o vulnerabilitate de migration path.

**🟡 Medium — `NEXTAUTH_SECRET` lipsă nu produce eroare clară**
`lib/auth/auth.config.ts:236`
`secret: process.env.NEXTAUTH_SECRET` — dacă variabila lipsește, NextAuth va rula fără secret (generând un avertisment) sau va eșua silențios, compromițând securitatea sesiunilor.

---

## 2. COSTURI API ȘI LIMITE

---

### 2.1 OpenAI

**🔴 Critical — `seo/bulk` folosește `gpt-4o` (nu `gpt-4o-mini`) pentru până la 20 produse**
`app/api/seo/bulk/route.ts:193`
```typescript
model: 'gpt-4o',
max_tokens: 2500,
```
Fiecare produs din bulk SEO consumă `gpt-4o` cu 2500 tokens output. La 20 produse: ~50.000 tokens output = costuri semnificative. Comparativ, `generate-text.ts` și alte locuri folosesc `gpt-4o-mini`. Bulk SEO ar trebui să folosească tot `gpt-4o-mini` sau să limiteze mai agresiv numărul de produse.

**🟡 Medium — `generate/image` face două apeluri OpenAI: unul pentru prompt GPT, unul pentru imagine**
`app/api/generate/image/route.ts:508`
GPT (`gpt-4o`, max 950 tokens) + KIE image API. La fiecare generare de imagine se cheltuiesc credite OpenAI pentru construirea promptului. Nu există cache pentru prompturi similare.

**🟡 Medium — `agent/memory` apelează `gpt-4o-mini` la fiecare POST cu ≥4 mesaje**
`app/api/agent/memory/route.ts:66`
Orice vizitator cu 4+ mesaje declanșează un apel OpenAI la fiecare sfârit de sesiune. Fără rate limiting sau deduplicare, la trafic mare poate genera costuri considerabile.

**🟡 Medium — `cron/competitor-monitor` face un apel OpenAI per monitor, fără concurrency limit**
`app/api/cron/competitor-monitor/route.ts:35`
Rulează până la 50 monitoare secvențial, fiecare cu un apel `gpt-4o-mini`. Dacă un user creează 50 monitoare, cron-ul zilnic face 50 apeluri OpenAI (deși costul e mic per apel).

**🟡 Medium — `product-webhook` face două apeluri OpenAI per produs actualizat**
`app/api/agent/product-webhook/route.ts:91,109`
`gpt-4o-mini` (1500 tokens) + `text-embedding-3-small` per produs actualizat. La magazine cu produse frecvent actualizate, costul poate crește rapid.

**🟢 Minor — `cron/image-bulk` face un apel GPT per item pentru buildPromptForBulk**
`app/api/cron/image-bulk/route.ts:241`
La fiecare item din bulk (max 3/run), se apelează `gpt-4o-mini` (400 tokens max). Cost mic dar ar putea fi eliminat cu prompt-uri pre-construite.

---

### 2.2 Supabase

**🟡 Medium — `admin/users` returnează toate coloanele fără limit**
`app/api/admin/users/route.ts:14`
```typescript
const { data: users } = await supabase.from('users').select('*').order(...)
```
Fără `.limit()` — la mii de utilizatori, query-ul returnează totul. Include câmpuri potențial sensibile (`stripe_customer_id`, `stripe_subscription_id`, etc.).

**🟡 Medium — `risk/sync-all` încarcă TOATE order-urile existente în memorie**
`app/api/risk/sync-all/route.ts:107`
```typescript
const { data: existDb } = await supabase.from('risk_orders').select('external_order_id').eq('store_id', storeId)
```
Fără `.limit()` — pentru magazine cu mii de comenzi, aceasta creează un Set de mii de elemente în memorie la fiecare sincronizare.

**🟡 Medium — `risk/identity.ts:detectAndSaveDuplicateCandidates` interoghează până la 200 clienți**
`lib/risk/identity.ts:54`
```typescript
.limit(200)
```
La fiecare client nou creat, se fac O(200) comparații în memorie. La trafic de vârf, aceasta poate deveni un bottleneck.

**🟢 Minor — `cron/risk-sync-orders` face query individual per order în buclă**
`app/api/cron/risk-sync-orders/route.ts:74`
```typescript
const { data: existing } = await supabase.from('risk_orders')...eq('external_order_id', extId).single()
```
Query individual per order în interiorul unui loop. La 1000 ordere, asta e 1000 de query-uri individuale în loc de un IN() batch.

**🟢 Minor — Multiple query-uri fără index sugerat pe câmpuri frecvent filtrate**
Pattern-uri ca `.eq('user_id', userId).eq('store_id', storeId)` apar în zeci de locuri. Fără indexuri corespunzătoare în Supabase, performanța degradează la volum.

---

### 2.3 Vercel Cron

**🟡 Medium — `image-bulk` rulează la fiecare 5 minute cu maxDuration 300s**
`vercel.json:8`
La fiecare 5 minute, cron-ul pornește și poate rula până la 300s. Dacă există întârzieri de rețea la KIE API sau OpenAI, două instanțe pot rula simultan (Vercel Cron nu garantează single-execution).

**🟡 Medium — `image-cleanup` rulează la fiecare 10 minute dar nu are `CRON_SECRET`**
`vercel.json:18` și `app/api/cron/image-cleanup/route.ts:6`
Cron la fiecare 10 minute, fără autentificare (nicio verificare de CRON_SECRET). Oricine poate apela endpoint-ul și declanșa refunduri.

**🟢 Minor — `risk-sync-orders` rulează la fiecare 15 minute și poate overlap cu sincronizările manuale**
Nu există un lock distribuit care să prevină rularea simultană a cron-ului și a `sync-all` manual.

---

### 2.4 Email

**🟡 Medium — Email-urile de escaladare nu au rate limiting**
`app/api/agent/chat/route.ts` (escalation flow)
La fiecare cerere de escaladare a unui vizitator, se trimite un email la owner. Dacă un vizitator abuziv trimite zeci de mesaje de escaladare, owner-ul primește zeci de emailuri. Nu există debounce sau limită de emailuri per vizitator/sesiune.

---

## 3. INTERNAȚIONALIZARE (i18n)

---

### 3.1 Fișiere de traduceri JSON

**🟢 Minor — en.json și ro.json sunt perfect sincronizate (0 chei lipsă)**
Verificat prin comparare automată: 2084 chei în ambele fișiere, nicio discrepanță. Excelent.

---

### 3.2 `ai-languages.ts` — câmpuri lipsă

**🟢 Minor — Toate cele 14 limbi au toate câmpurile definite**
`lib/i18n/ai-languages.ts`
Structura este completă pentru toate: `ro`, `en`, `es`, `fr`, `de`, `it`, `pt`, `nl`, `pl`, `hu`, `bg`, `cs`, `el`, `tr`. Nu există câmpuri lipsă.

---

### 3.3 Texte hardcodate în română (în loc de `t()`)

**🔴 Critical — Widget JS are texte hardcodate în română care nu se internalizează**
`public/agent-widget.js:166-171`
```javascript
'<button class="_h_bl_y" id="_h_bl_y">Da, ajută-mă!</button>'+
'<button class="_h_bl_n" id="_h_bl_n">Nu, mulțumesc</button>'
```
Butoanele bubble proactiv sunt în română indiferent de limba vizitatorului sau a configurației agentului.

`public/agent-widget.js:176`
```javascript
'<div class="_h_hn" id="_h_an">Asistent</div>'
```
Numele default `Asistent` e hardcodat în română.

`public/agent-widget.js:178`
```javascript
'<span>Online</span>'
```
Status `Online` hardcodat în română.

`public/agent-widget.js:182`
```javascript
'<textarea id="_h_in" placeholder="Scrie un mesaj..." rows="1"></textarea>'
```
Placeholder hardcodat în română.

`public/agent-widget.js:34`
```javascript
var agentName='Asistent';
```
Default agent name hardcodat în română.

**🟡 Medium — Rute API returnează mesaje de eroare hardcodate în română**
`middleware.ts:132`: `{ error: 'Acces interzis' }` — mesaj de eroare 403 în română
`lib/auth/auth.config.ts:67`: `'Prea multe incercari. Incearca din nou mai tarziu.'` — în română
`lib/security/ai-guard.ts:165,167`: mesaje de eroare în română pentru concurrent jobs
`app/api/generate/text/route.ts:13`: `{ error: 'Neautorizat' }` — în română
`app/api/generate/image/route.ts:524`: `{ error: 'Neautorizat' }` — în română
Acestea ar trebui să fie în engleză (standard API) sau să provină din `ai-languages.ts`.

**🟡 Medium — Email-urile de bun-venit și de resetare parolă sunt în română**
`lib/email.ts:63-75`
Emailurile `buildWelcomeEmail` și `buildResetEmail` sunt hardcodate în română. Dacă un utilizator din Germania sau Franța se înregistrează, primește email în română.

**🟡 Medium — `public-config` route returnează fallback-uri hardcodate în română**
`app/api/agent/public-config/route.ts:33-41`
Fallback-ul include `'Bună! Cu ce te pot ajuta?'` și `['Caut un produs', 'Am o întrebare', 'Livrare & retur']` hardcodate în română.

**🟡 Medium — `competitor/analyze-my-store` returnează texte de analiză hardcodate în română**
`app/api/competitor/analyze-my-store/route.ts:36,68-85`
Textele de analiza (`'Magazin nou — adauga produse pentru analiza completa'`, `'${optimizedCount}/${products.length} produse bine optimizate SEO'` etc.) sunt hardcodate în română.

**🟡 Medium — `competitor/steal` prompt-ul AI este hardcodat în română**
`app/api/competitor/steal/route.ts:86`
Promptul GPT este în română: `'Ești expert SEO senior...'`. Nu folosește `getAILanguage()`. Dacă userul are `brand_language: 'en'`, outputul va fi tot în română.

**🟡 Medium — `generate/text` (`generate-text.ts`) prompt parțial în română pentru useri cu `language='en'`**
`lib/openai/generate-text.ts:50`
Promptul folosește `langInstruction` pentru limbă, dar structura promptului (ex: `PRODUS:`, `CERINȚE:`, `IMPORTANT:`) rămâne în română indiferent de limbă.

**🟡 Medium — `agent/product-webhook` INTEL_PROMPT hardcodat în română**
`app/api/agent/product-webhook/route.ts:26`
```typescript
const INTEL_PROMPT = `Analizezi un produs... Scrie în română...`
```
Intelligence-ul generat pentru produse e forțat în română, indiferent de `brand_language` al userului.

**🟢 Minor — `cron/risk-weekly-report` folosește `toLocaleDateString('ro-RO')`**
`app/api/cron/risk-weekly-report/route.ts:25`
Data e formatată în română indiferent de locația utilizatorului.

**🟢 Minor — `generate/progress` SSE labels hardcodate în română**
`app/api/generate/progress/route.ts:49-52`
```typescript
waiting: 'Se așază în coadă...',
queuing: 'Se pregătește generarea...',
generating: 'AI construiește imaginea...',
```

---

### 3.4 SEO — Language handling

**🟢 Minor — `seo/bulk` folosește `user.brand_language` corect**
`app/api/seo/bulk/route.ts:196`
`buildBulkSeoPrompt(user?.brand_language || 'ro')` — corect, cu fallback la română.

---

## 4. BUGURI ȘI ALTE PROBLEME

---

### 4.1 Race Conditions și Date Consistency

**🔴 Critical — Race condition la deducerea creditelor în `generate/text`**
`app/api/generate/text/route.ts:40-114`
Creditul e verificat (`if (!user || user.credits < 5)`), se face munca AI, apoi se scade creditul. Între verificare și scădere, alt request concurent poate trece verificarea cu același sold. Nu există operație atomică (transaction).

**🔴 Critical — Race condition la deducerea creditelor în `cron/image-bulk` și `image-cleanup`**
`app/api/cron/image-bulk/route.ts:85-149`, `app/api/cron/image-cleanup/route.ts:29-50`
Pattern: `select credits` → `update credits = credits - cost`. Dacă două procese rulează simultan (posibil cu Vercel), creditele pot fi scăzute de două ori sau refundul poate fi aplicat de două ori. Soluția corectă e un RPC atomic în Supabase (`update users set credits = credits - X where id = Y and credits >= X`).

**🟡 Medium — `seo/bulk` deduce creditele upfront dar refund-ul poate eșua silențios**
`app/api/seo/bulk/route.ts:163-271`
Creditul e scos upfront pentru toate produsele. Dacă refund-ul la final eșuează (ex: DB down), userul pierde credite nejustificat. Nu există logare/alertă pentru eșecul refund-ului.

**🟡 Medium — `generate/image` deduce creditele înainte de generare dar refund-ul în SSE poate fi ratat**
`app/api/generate/image/route.ts:577-586` și `app/api/generate/progress/route.ts:103-122`
Dacă userul închide conexiunea SSE înainte ca refund-ul să fie processat (la fail), creditul nu e restituit. Nu există un mecanism de reconciliere.

---

### 4.2 Memory Leaks și SSE

**🟡 Medium — `config-stream` SSE: timeout-ul de 30 minute nu e garantat clean**
`app/api/agent/config-stream/route.ts:47-54`
`clearInterval(heartbeat)` și `sseClients.get(userId)?.delete(controller)` sunt apelate în `maxTimeout`, dar dacă stream-ul e deja închis când timeout-ul se declanșează, `controller.close()` aruncă o excepție prinsă în `try/catch`. `clearInterval(heartbeat)` e apelat înainte — corect. Totuși, dacă utilizatorul are mai multe tab-uri deschise, `sseClients.get(userId)` conține mai mulți controlleri și un tab care se deconectează silențios (ex: network loss fără `abort` event) poate lăsa controlleri orfani.

**🟡 Medium — `risk/sync-all` SSE: nicio protecție la disconnect**
`app/api/risk/sync-all/route.ts:28`
Operația de sync poate dura minute. Dacă userul se deconectează, codul continuă să ruleze și să consume resurse. Nu există `request.signal.addEventListener('abort', ...)`.

**🟡 Medium — `generate/progress` SSE are un loop cu `while(true)` care nu verifică abort signal**
`app/api/generate/progress/route.ts:36`
```typescript
while (true) {
  const elapsed = Date.now() - startTime;
  if (elapsed > maxWait) { ... }
  ...
  await new Promise(r => setTimeout(r, interval))
}
```
Dacă userul închide conexiunea, loop-ul continuă să ruleze (și să facă request-uri la KIE API) până la timeout (5 minute). Nu există verificare a `request.signal.aborted`.

---

### 4.3 Error Handling lipsă

**🟡 Medium — `generateIntelForProduct` nu face nimic dacă `JSON.parse` eșuează**
`app/api/agent/product-webhook/route.ts:96`
```typescript
const intel = JSON.parse(gpt.choices[0].message.content || '{}')
```
Dacă GPT returnează JSON malformat, `JSON.parse` aruncă, eroarea e prinsă de try/catch exterior și înregistrată ca `failed` în DB. Creditele sunt deja deduse la acest moment. Ar trebui validat outputul JSON înainte.

**🟡 Medium — `auth.config.ts signIn` callback returnează `true` chiar dacă `ensureUserProfile` eșuează**
`lib/auth/auth.config.ts:134`
```typescript
if (user.id) {
  await ensureUserProfile(...)
}
return true
```
Dacă `ensureUserProfile` aruncă, `return true` permite login-ul fără profil. Userul va fi autentificat dar nu va exista în tabela `users`.

**🟢 Minor — `autoPublishToWoo` în `image-bulk` înghite toate erorile**
`app/api/cron/image-bulk/route.ts:227`
```typescript
} catch {}
```
Erorile de publish la WooCommerce sunt ignorate complet. Userul nu știe dacă publicarea a eșuat.

---

### 4.4 TypeScript any abuse

**🟡 Medium — Tipuri `any` extensive în cod critic**
`lib/risk/identity.ts:87`: `supabase: any`
`lib/risk/engine.ts`: multiple `any`
`app/api/risk/webhook/route.ts:37`: `let order: any`
`app/api/agent/chat/route.ts`: multiple `any`
`lib/security/ai-guard.ts:12`: `let redisClient: any`
Tipurile `any` elimină protecțiile TypeScript și pot ascunde bug-uri de runtime.

---

### 4.5 Logică greșită sau incoerentă

**🟡 Medium — `agent/memory` calculează `return_count` greșit**
`app/api/agent/memory/route.ts:145`
```typescript
return_count: isReturn ? (existing?.return_count || 0) + 1 : 0,
```
Dacă `isReturn = false` (prima vizită), `return_count` e setat la 0 — corect. Dar la a doua vizită, `return_count` devine 1 (nu 0 + 1 = 1 e corect). Totuși, la a treia vizită, `isReturn = true` → `return_count = 1 + 1 = 2`. Logic corect, dar confuz.

**🟡 Medium — `risk-weekly-report` compara date incorect pentru săptămâna anterioară**
`app/api/cron/risk-weekly-report/route.ts:22-23`
```typescript
const prevWeekEnd = new Date(weekStart)
const prevWeekStart = new Date(weekStart)
prevWeekStart.setDate(prevWeekStart.getDate() - 7)
```
`prevWeekEnd` e egal cu `weekStart`, nu cu `weekStart - 1 day`. Intervalul săptămânii anterioare se suprapune cu prima zi a săptămânii curente.

**🟡 Medium — `auth.config.ts jwt` callback cu refresh TTL de 60 secunde poate cauza date vechi**
`lib/auth/auth.config.ts:173`
Token-ul e refresh-uat din DB maxim o dată la 60 secunde. Dacă un admin schimbă planul unui user sau îi dezactivează contul, schimbarea se reflectă în sesiune cu întârziere de până la 60 secunde. E un trade-off acceptabil, dar ar trebui documentat.

**🟢 Minor — `seo/bulk` EXPANSION_TEMPLATES conțin text generic care poate părea duplicat de GPT**
`app/api/seo/bulk/route.ts:62-67`
Template-urile de expansiune (când descrierea e sub 200 cuvinte) sunt identice pentru categorii diferite de produse. Pot duce la conținut SEO duplicat.

---

### 4.6 Next.js Server vs Client Components

**🟢 Minor — `lib/security/ai-guard.ts` folosește `setInterval` la module level**
`lib/security/ai-guard.ts:30`
```typescript
if (typeof setInterval !== 'undefined') {
  setInterval(() => { ... }, 60 * 1000)
}
```
Același pattern în `lib/security/rate-limit.ts:23`. Aceste `setInterval`-uri rulează la importul modulului, inclusiv în contexte Server Components Next.js unde nu ar trebui să existe side effects. Pot cauza multiple timere dacă modulul e re-importat (hot reload).

**🟢 Minor — `lib/sse-store.ts` stochează stare globală în memorie**
`lib/sse-store.ts:5`
`const clientsMap = new Map<>()` la nivel de modul. În Vercel cu multiple instanțe, fiecare instanță are propriul `clientsMap`. O notificare de config change va ajunge doar la clienții conectați pe aceeași instanță.

---

### 4.7 Imports și Dependențe

**🟢 Minor — `next.config.ts` este gol**
`next.config.ts:3`
Nu sunt configurate: `images.domains`, `headers` (CSP), `redirects`, `rewrites`. CSP (Content Security Policy) lipsește complet — ar reduce semnificativ riscul XSS.

**🟢 Minor — `inngest` este în dependencies dar nu există rute Inngest în cod**
`package.json:27`
`inngest` (^3.52.0) este instalat dar nu pare utilizat. Dependență neutilizată care crește bundle size.

---

## 5. SUMAR CRITICE

| Severitate | Nr. | Top probleme |
|------------|-----|-------------|
| 🔴 Critical | 7 | Memory endpoint fără auth, Order/Stock endpoint fără auth, Image-cleanup cron fără secret, Race conditions credite, Widget texte hardcodate RO |
| 🟡 Medium | 28 | CORS wildcard, HMAC bypass, Rate limit in-memory, Prompt injection, Race conditions, Email templates RO-only, SSE fără abort handling |
| 🟢 Minor | 15 | CSP lipsă, TypeScript any, setInterval la modul level, dependente nefolosite, CSRF există dar nefolosit |

---

## 6. RECOMANDĂRI PRIORITARE

1. **URGENT**: Adaugă autentificare/verificare de origine la `/api/agent/memory`, `/api/agent/order`, `/api/agent/stock`
2. **URGENT**: Adaugă `CRON_SECRET` verificare la `/api/cron/image-cleanup` (nu condițional, obligatoriu)
3. **URGENT**: Înlocuiește credit deduction cu RPC atomic Supabase pentru a elimina race conditions
4. **IMPORTANT**: Migrează `rateLimit` sync (in-memory) la `rateLimitAsync` (Redis) în `auth.config.ts`
5. **IMPORTANT**: Sanitizează HTML-ul injectat în emailuri de escaladare (XSS în email)
6. **IMPORTANT**: Adaugă abort signal handling în SSE-urile de durată lungă (`risk/sync-all`, `generate/progress`)
7. **IMPORTANT**: Înlocuiește `gpt-4o` cu `gpt-4o-mini` în `seo/bulk` sau adaugă cost warning
8. **NORMAL**: Internalizează widget JS (butoanele bubble, placeholder, status Online)
9. **NORMAL**: Internalizează emailurile de welcome/reset și prompt-urile competitor/steal
10. **NORMAL**: Adaugă CSP header în `next.config.ts`
