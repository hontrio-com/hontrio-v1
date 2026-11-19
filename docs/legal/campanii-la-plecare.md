# Campaniile Hontrio la plecarea clientului: propunere pentru Termeni

Propunere din 19.11.2026, de verificat cu avocatul înainte de publicare.

## De ce

Un client poate lansa campaniile prin Hontrio, poate lăsa pilotul să le pună la punct, apoi poate pleca (deconectează Google, șterge magazinul sau contul) exact când încep să aducă vânzări. Taxa Hontrio se socotește din vânzările aduse de campaniile Hontrio (art. 9), dar după plecare Hontrio nu mai vede comenzile. Campaniile ar rula mai departe, fără plată.

Regula nouă: la plecare, Hontrio șterge din contul Google Ads al clientului campaniile pe care le-a creat.

## Ce spun Termenii acum (versiunea 2026-11-16)

- **14.5.** Campaniile create de Hontrio sunt în contul tău Google Ads și continuă să ruleze și să cheltuie după ce deconectezi Google, după ce ștergi magazinul sau contul și după încetarea contractului, până le oprești sau le ștergi tu. Din acel moment Hontrio nu le mai urmărește și nu le mai oprește. Îți recomandăm să le pui pe pauză înainte.
- **15.2.** Poți trece oricând la alt furnizor, conform Regulamentului (UE) 2023/2854 privind datele: nu cerem preaviz, nu percepem costuri de schimbare și nu aplicăm penalități. Campaniile sunt deja în contul tău Google Ads, deci rămân la tine.
- **16.2** (fragment). Nu răspundem pentru: (…) campaniile lăsate să ruleze după deconectare, ștergere, suspendare sau încetare (…).
- **18.1.** Te anunțăm pe e-mail și în aplicație cu cel puțin 30 de zile înainte de orice modificare, spunându-ți ce se schimbă.

## Textul propus

### 14.5

**RO.** **Când deconectezi Google din Hontrio, ștergi un magazin, îți ștergi contul sau contractul încetează, Hontrio șterge din contul tău Google Ads campaniile pe care le-a creat**, cu bugetele lor (la ștergerea unui magazin, doar campaniile lui). Ștergerea este definitivă: o campanie ștearsă nu mai poate fi pornită, iar Google îi păstrează doar istoricul. Celelalte campanii din cont nu le atingem. Dacă în acel moment accesul la Google nu mai funcționează (de exemplu, pentru că l-ai retras direct din contul Google), nu le putem șterge, iar ele rulează mai departe până le oprești tu. Înainte să pleci, poți descărca din Setări structura campaniilor (15.1).

**EN.** **When you disconnect Google from Hontrio, delete a store, delete your account or the contract ends, Hontrio deletes from your Google Ads account the campaigns it created**, together with their budgets (when a store is deleted, only its campaigns). The deletion is permanent: a deleted campaign can't be started again, and Google keeps only its history. We don't touch any other campaigns in the account. If at that moment the access to Google no longer works (for example, because you revoked it directly in your Google account), we can't delete them, and they keep running until you stop them. Before you leave, you can download the structure of your campaigns from Settings (15.1).

### 15.2

**RO.** Poți trece oricând la alt furnizor, conform Regulamentului (UE) 2023/2854 privind datele: nu cerem preaviz, nu percepem costuri de schimbare și nu aplicăm penalități. Datele tale, inclusiv structura campaniilor, le poți descărca oricând din Setări (15.1). Campaniile create de Hontrio se șterg din Google Ads la plecare (14.5).

**EN.** You can switch to another provider at any time, under Regulation (EU) 2023/2854 (the Data Act): we require no notice, charge no switching costs and apply no penalties. You can download your data, including the structure of your campaigns, from Settings at any time (15.1). The campaigns created by Hontrio are deleted from Google Ads when you leave (14.5).

### 16.2, fragmentul despre campanii

**RO.** (…) campaniile lăsate să ruleze în timpul suspendării sau după ce ai retras accesul Google direct din contul Google; ștergerea campaniilor Hontrio la plecare, după 14.5 (…)

**EN.** (…) campaigns left running during a suspension or after you revoked the Google access directly in your Google account; the deletion of the Hontrio campaigns when you leave, under 14.5 (…)

## Întrebări pentru avocat

1. **Data Act.** Este compatibilă ștergerea campaniilor la plecare cu art. 23–25 (fără piedici la schimbarea furnizorului) și cu art. 29 (costurile de schimbare) din Regulamentul (UE) 2023/2854? Contează că:
   - datele, inclusiv structura campaniilor, rămân descărcabile oricând (15.1);
   - campaniile sunt create de serviciu;
   - clienții sunt firme.
2. **Clienții actuali.** Pentru clienții care au acceptat versiunea 2026-11-16, ajunge anunțul cu 30 de zile înainte (18.1) sau este mai bine să le cerem din nou acordul?
3. **Încetarea de către Hontrio.** Ștergerea trebuie să se aplice și când Hontrio încetează contractul (14.3), de exemplu pentru fraudă?
4. **Formularea.** Ce trebuie să conțină avertismentul din aplicație, afișat înainte de deconectare și de ștergerea contului? Textul de acum este în secțiunea de mai jos.

## Ce face aplicația (deja construit, oprit până la publicare)

- **Când:**
  - la deconectarea Google, sunt șterse toate campaniile Hontrio ale contului;
  - la ștergerea unui magazin, doar campaniile magazinului;
  - la ștergerea contului, făcută de client sau de un administrator, toate.
- **Ce:**
  - campaniile primesc starea „REMOVED” în Google Ads și li se șterg bugetele;
  - celelalte campanii din cont nu se ating.
- **Când nu se poate șterge:** dacă accesul Google nu mai merge sau Google refuză, plecarea continuă oricum, nimeni nu este ținut în cont. Ce n-a mers rămâne în jurnal, iar clientul vede câte campanii n-au putut fi șterse.
- **Avertismentele din Setări.** La deconectarea Google, la ștergerea magazinului și la ștergerea contului, clientul vede:
  - „Hontrio șterge definitiv din Google Ads campaniile pe care le-a creat, cu bugetele lor, iar ele nu mai pot fi pornite din nou. Celelalte campanii din cont rămân cum sunt.”
  - Pentru magazin: „Hontrio șterge definitiv din Google Ads campaniile create pentru el (…)”.
- **Oprit până la publicare.** Constantele `LEAVE_REMOVAL_TERMS_VERSION` și `LEAVE_REMOVAL_FROM` din `lib/ads/remove.ts` sunt nule. Până atunci nu se șterge nimic, iar avertismentele rămân cele de acum („campaniile rămân în contul tău”).

## Pornirea, după avizul avocatului

1. Pune textul aprobat (RO și EN) în `app/(marketing)/legal/terms/page.tsx` și schimbă „Versiunea în vigoare”.
2. În `lib/auth/validation.ts`, `TERMS_VERSION` primește data noii versiuni.
3. În `lib/ads/remove.ts`:
   - `LEAVE_REMOVAL_TERMS_VERSION` primește aceeași dată. Regula se aplică de la acceptare celor care acceptă Termenii noi.
   - `LEAVE_REMOVAL_FROM` primește ziua anunțului plus 30 de zile. De atunci regula se aplică tuturor.
4. În ziua anunțului, trimite tuturor clienților un e-mail și o notificare în aplicație, din Admin, la Notificare globală, cu ce se schimbă.
