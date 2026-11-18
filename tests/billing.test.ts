import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  billable, buildStatement, convert, fromHontrio, lastDay, neededRates, nextPeriod, orderValue, periodBounds,
  previousPeriod, refundCredit, statementCurrency, type BillingOrder,
} from '@/lib/billing/statement'
import { addDays, billingActive, countFrom, daysBetween, dunningStep, earliestStart, periodToClose, todayRo } from '@/lib/billing/schedule'
import { cleanCui, parseAnaf, validCui } from '@/lib/billing/anaf'
import { parseEcbCsv } from '@/lib/billing/ecb'
import { clientVatCode, createInvoice, invoicePayload, smartBillConfig, SmartBillError, smartBillErrorText, type SmartBillConfig } from '@/lib/billing/smartbill'
import { json, stubNetwork } from './store-api-stub'
import { checkProfile } from '@/lib/billing/profile'
import { dueReminderMail, finalReminderMail, invoiceMail, noticeMail, paidMail, profileMissingMail, suspendedMail } from '@/lib/billing/emails'
import { tIn } from '@/lib/ads/emails'

// Facturarea după Termeni, art. 9: ce comenzi se numără și cu ce valoare, taxa și
// creditul din rambursări, calendarul (15 ale lunii, 10 zile, amintiri, suspendare),
// ANAF, cursurile BCE, cererea SmartBill și textele e-mailurilor.

const order = (id: string, over: Partial<BillingOrder> = {}): BillingOrder => ({
  id, order_number: id.toUpperCase(), external_id: id, placed_at: '2026-11-10T10:00:00.000Z',
  state: 'fulfilled', payment_status: 'paid', currency: 'RON',
  subtotal: 1210, discount: 0, tax: 210, total: 1210, utm_campaign: 'hontrio-123', ...over,
})

test('se numără doar comenzile din campaniile Hontrio, după ultimul clic', () => {
  assert.equal(fromHontrio({ utm_campaign: 'hontrio-22388803385' }), true)
  assert.equal(fromHontrio({ utm_campaign: ' Hontrio-1 ' }), true)
  assert.equal(fromHontrio({ utm_campaign: 'brand-hontrio-1' }), false)
  assert.equal(fromHontrio({ utm_campaign: 'google' }), false)
  assert.equal(fromHontrio({ utm_campaign: null }), false)
})

test('doar comenzile plătite sau livrate; anulate, rambursate, chiar și parțial, nu', () => {
  assert.equal(billable({ state: 'fulfilled', payment_status: 'unpaid' }), true, 'livrată, plătită la livrare')
  assert.equal(billable({ state: 'confirmed', payment_status: 'paid' }), true)
  assert.equal(billable({ state: 'confirmed', payment_status: 'PAID' }), true)
  assert.equal(billable({ state: 'confirmed', payment_status: 'unpaid' }), false, 'ramburs încă nelivrat')
  assert.equal(billable({ state: 'pending', payment_status: null }), false)
  assert.equal(billable({ state: 'cancelled', payment_status: 'paid' }), false)
  assert.equal(billable({ state: 'refunded', payment_status: 'refunded' }), false)
  assert.equal(billable({ state: 'fulfilled', payment_status: 'partially_refunded' }), false, 'suma rambursată nu se știe')
})

test('valoarea: produsele după reduceri, fără transport și fără TVA', () => {
  // Exemplul din contractul Edinio: 264,90 produse, 10 cupon, 15 transport, 4,99 ramburs, 45,67 TVA, 274,89 total
  assert.equal(orderValue({ subtotal: 264.9, discount: 10, tax: 45.67, total: 274.89 }), 212.55)
  // 21%: 1.210 cu TVA → 1.000 fără
  assert.equal(orderValue({ subtotal: 1210, discount: 0, tax: 210, total: 1210 }), 1000)
  // Magazin neplătitor de TVA: valoarea rămâne
  assert.equal(orderValue({ subtotal: 500, discount: 50, tax: 0, total: 470 }), 450)
  // Reducere mai mare decât produsele: 0, nu negativ
  assert.equal(orderValue({ subtotal: 20, discount: 30, tax: 0, total: 15 }), 0)
})

test('moneda situației și transformarea prin euro, la cursul BCE', () => {
  assert.equal(statementCurrency('RON'), 'RON')
  assert.equal(statementCurrency('eur'), 'EUR')
  assert.equal(statementCurrency('HUF'), 'EUR')
  assert.equal(statementCurrency(null), 'EUR')
  const rates = { RON: 5, HUF: 400 }
  assert.equal(convert(100, 'EUR', 'RON', rates), 500)
  assert.equal(convert(500, 'RON', 'EUR', rates), 100)
  assert.equal(convert(40000, 'HUF', 'EUR', rates), 100)
  assert.equal(convert(40000, 'HUF', 'RON', rates), 500)
  assert.equal(convert(10, 'USD', 'EUR', rates), null, 'cursul lipsă nu se ghicește')
  assert.deepEqual(neededRates([{ currency: 'RON' }], 'RON'), [])
  assert.deepEqual(neededRates([{ currency: 'EUR' }], 'RON').sort(), ['RON'])
  assert.deepEqual(neededRates([{ currency: 'HUF' }], 'EUR'), ['HUF'])
})

test('luna: precedenta, următoarea, ultima zi și granițele în ora României', () => {
  assert.equal(previousPeriod('2026-12-15'), '2026-11')
  assert.equal(previousPeriod('2027-01-15'), '2026-12')
  assert.equal(nextPeriod('2026-12'), '2027-01')
  assert.equal(lastDay('2026-02'), '2026-02-28')
  assert.equal(lastDay('2028-02'), '2028-02-29')
  // Iarna România e UTC+2, vara UTC+3
  assert.deepEqual(periodBounds('2026-11', 'Europe/Bucharest'), { from: '2026-10-31T22:00:00.000Z', to: '2026-11-30T22:00:00.000Z' })
  assert.deepEqual(periodBounds('2026-07', 'Europe/Bucharest'), { from: '2026-06-30T21:00:00.000Z', to: '2026-07-31T21:00:00.000Z' })
})

test('creditul din rambursări: taxa lunii facturate, recalculată fără comenzile rambursate', () => {
  // 20.000 lei → 400; fără 1.000 → 19.000 → 380: credit 20
  assert.equal(refundCredit({ id: 'a', currency: 'RON', sales: 20000, refunded_value: 0, new_refunds: 1000 }), 20)
  // 6.000 lei → 199; fără 2.000 → sub prag: credit 199
  assert.equal(refundCredit({ id: 'b', currency: 'RON', sales: 6000, refunded_value: 0, new_refunds: 2000 }), 199)
  // A doua rambursare pornește de la ce s-a scăzut deja: 20.000 − 1.000 − 1.000 → 360 față de 380
  assert.equal(refundCredit({ id: 'c', currency: 'RON', sales: 20000, refunded_value: 1000, new_refunds: 1000 }), 20)
  assert.equal(refundCredit({ id: 'd', currency: 'RON', sales: 20000, refunded_value: 0, new_refunds: 0 }), 0)
})

test('situația lunii: comenzile numărate, taxa din grilă, creditul și restul lui', () => {
  const orders = [
    order('a', { subtotal: 7260, tax: 1260, total: 7260 }),                 // 6.000
    order('b', { subtotal: 2420, tax: 420, total: 2420 }),                  // 2.000
    order('c', { utm_campaign: 'google-shopping' }),                        // nu e Hontrio
    order('d', { state: 'cancelled' }),                                     // anulată
    order('e', { state: 'confirmed', payment_status: 'unpaid' }),           // ramburs nelivrat
    order('f'),                                                             // contestată
    order('g', { placed_at: '2026-11-02T08:00:00.000Z' }),                  // înainte de pornire
    order('h', { currency: 'EUR', subtotal: 121, tax: 21, total: 121 }),    // 100 € → 500 lei
  ]
  const s = buildStatement({
    period: '2026-11', storeCurrency: 'RON', timeZone: 'Europe/Bucharest', orders,
    excluded: new Set(['f']), startDate: '2026-11-05', rates: { RON: 5 }, credit: 0,
  })
  assert.equal(s.currency, 'RON')
  assert.deepEqual(s.orders.map(o => o.id).sort(), ['a', 'b', 'h'])
  assert.equal(s.sales, 8500)
  assert.equal(s.fee, 199)
  assert.equal(s.amount, 199)
  assert.deepEqual(s.orders.find(o => o.id === 'h')!.original, { value: 100, currency: 'EUR' })

  // Creditul se scade din taxă; ce nu încape trece în luna următoare
  const credited = buildStatement({ period: '2026-11', storeCurrency: 'RON', timeZone: 'Europe/Bucharest', orders, excluded: new Set(['f']), startDate: '2026-11-05', rates: { RON: 5 }, credit: 250 })
  assert.equal(credited.adjustment, -199)
  assert.equal(credited.amount, 0)
  assert.equal(credited.credit_carry, 51)

  // Fără cursul unei monede, comanda nu se ghicește: se raportează
  const missing = buildStatement({ period: '2026-11', storeCurrency: 'RON', timeZone: 'Europe/Bucharest', orders: [order('x', { currency: 'USD' })], excluded: new Set(), startDate: '2026-11-01', rates: {}, credit: 0 })
  assert.deepEqual(missing.missingRates, ['USD'])
  assert.equal(missing.sales, 0)
})

test('calendarul: factura pe 15, pornirea după 30 de zile, amintirile și suspendarea', () => {
  assert.equal(addDays('2026-12-15', 10), '2026-12-25')
  assert.equal(addDays('2026-12-25', 14), '2027-01-08')
  assert.equal(daysBetween('2026-12-25', '2027-01-08'), 14)
  assert.equal(earliestStart('2026-11-18'), '2026-12-18')
  assert.equal(billingActive(null, '2026-12-20'), false)
  assert.equal(billingActive('2026-12-18', '2026-12-17'), false)
  assert.equal(billingActive('2026-12-18', '2026-12-18'), true)
  assert.match(todayRo(Date.parse('2026-11-30T23:30:00Z')), /^2026-12-01$/, 'ora României, nu UTC')

  assert.equal(periodToClose('2027-01-14', '2026-12-18'), null, 'înainte de 15')
  assert.equal(periodToClose('2027-01-15', '2026-12-18'), '2026-12')
  assert.equal(periodToClose('2027-01-20', '2026-12-18'), '2026-12', 'o zi pierdută se recuperează')
  assert.equal(periodToClose('2027-01-15', '2027-01-05'), null, 'decembrie s-a încheiat înainte de pornire')
  assert.equal(periodToClose('2027-01-15', null), null)
  assert.equal(countFrom('2026-12', '2026-12-18'), '2026-12-18')
  assert.equal(countFrom('2027-01', '2026-12-18'), '2027-01-01')

  const s = (reminders: number, suspended = false) => ({ due_date: '2026-12-25', reminders, suspended })
  assert.equal(dunningStep(s(0), '2026-12-24'), 'none')
  assert.equal(dunningStep(s(0), '2026-12-25'), 'remind_due')
  assert.equal(dunningStep(s(1), '2026-12-30'), 'none')
  assert.equal(dunningStep(s(1), '2027-01-01'), 'remind_final')
  assert.equal(dunningStep(s(0), '2027-01-01'), 'remind_final', 'amintirea finală nu se pierde')
  assert.equal(dunningStep(s(2), '2027-01-07'), 'none')
  assert.equal(dunningStep(s(2), '2027-01-08'), 'suspend')
  assert.equal(dunningStep(s(2, true), '2027-01-20'), 'none')
})

test('ANAF: CUI-ul curat și cifra de control, datele firmei din răspuns', () => {
  assert.equal(cleanCui('RO 43474393'), '43474393')
  assert.equal(cleanCui('43.474.393'), '43474393')
  assert.equal(cleanCui('abc'), null)
  assert.equal(validCui('43474393'), true)
  assert.equal(validCui('43474394'), false)
  assert.equal(validCui('18547290'), true)

  const company = parseAnaf({
    found: [{
      date_generale: { cui: 43474393, denumire: 'VOID SFT GAMES S.R.L.', adresa: 'JUD. GORJ, SAT MĂTĂSARI COM. MĂTĂSARI, STR. PROGRESULUI, NR.2', nrRegCom: 'J2020001054187', codPostal: '217295' },
      inregistrare_scop_Tva: { scpTVA: false },
      adresa_sediu_social: { sdenumire_Localitate: 'Sat Mătăsari Com. Mătăsari', sdenumire_Judet: 'GORJ', sdenumire_Strada: 'Str. Progresului', snumar_Strada: '2', sdetalii_Adresa: '', scod_Postal: '217295' },
    }],
    notFound: [],
  })
  assert.deepEqual(company, {
    name: 'VOID SFT GAMES S.R.L.', vat_code: '43474393', reg_com: 'J2020001054187', is_vat_payer: false,
    address: 'Str. Progresului, nr. 2', city: 'Sat Mătăsari Com. Mătăsari', county: 'Gorj', postal_code: '217295',
  })
  const buc = parseAnaf({ found: [{ date_generale: { cui: 1, denumire: 'X SRL', adresa: 'MUN. BUCUREŞTI, SECTOR 3, STR. X' }, inregistrare_scop_Tva: { scpTVA: true }, adresa_sediu_social: { sdenumire_Localitate: 'Sector 3 Mun. Bucureşti', sdenumire_Judet: 'MUNICIPIUL BUCUREŞTI' } }] })
  assert.equal(buc?.city, 'Sector 3')
  assert.equal(buc?.is_vat_payer, true)
  assert.equal(parseAnaf({ found: [], notFound: [123] }), null)
})

test('BCE: cel mai recent curs din CSV, pe monedă', () => {
  const csv = [
    'KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE',
    'EXR.D.RON.EUR.SP00.A,D,RON,EUR,SP00,A,2026-10-29,5.3441,A,"Romanian leu/Euro, ECB"',
    'EXR.D.RON.EUR.SP00.A,D,RON,EUR,SP00,A,2026-10-30,5.3447,A,"Romanian leu/Euro, ECB"',
    'EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-10-30,1.1172,A,"US dollar/Euro"',
  ].join('\n')
  assert.deepEqual(parseEcbCsv(csv), { RON: { day: '2026-10-30', rate: 5.3447 }, USD: { day: '2026-10-30', rate: 1.1172 } })
  assert.deepEqual(parseEcbCsv('nimic'), {})
})

const SB: SmartBillConfig = { username: 'u@x.ro', token: 't', cif: '43474393', series: 'HON', unit: 'buc', cardLink: true }

test('SmartBill: configurarea, codul fiscal al clientului și erorile', () => {
  assert.equal(smartBillConfig({}), null)
  assert.deepEqual(smartBillConfig({ SMARTBILL_USERNAME: 'u@x.ro', SMARTBILL_TOKEN: 't', SMARTBILL_CIF: '43474393', SMARTBILL_SERIES: 'HON' }), SB)
  assert.equal(smartBillConfig({ SMARTBILL_USERNAME: 'u', SMARTBILL_TOKEN: 't', SMARTBILL_CIF: '1', SMARTBILL_SERIES: 'S', SMARTBILL_CARD_LINK: 'false', SMARTBILL_UNIT: 'luna' })?.cardLink, false)

  assert.equal(clientVatCode({ vat_code: '18547290', is_vat_payer: true, country: 'RO' }), 'RO18547290')
  assert.equal(clientVatCode({ vat_code: 'RO18547290', is_vat_payer: false, country: 'RO' }), '18547290')
  assert.equal(clientVatCode({ vat_code: 'de 123456789', is_vat_payer: true, country: 'DE' }), 'DE123456789')

  assert.equal(smartBillErrorText({ errorText: 'Seria nu a fost gasita!<br/>Folositi o serie.' }), 'Seria nu a fost gasita!')
  assert.equal(smartBillErrorText({ errorText: '', errors: [{ message: 'Unrecognized property: zzz.', param: 'zzz' }] }), 'Unrecognized property: zzz. (zzz)')
  assert.equal(smartBillErrorText({ errorText: '', number: '12' }), null)
})

test('SmartBill: factura fără câmpuri de TVA, cu linkul de plată, în limba clientului', () => {
  const client = { name: 'Client SRL', vat_code: '18547290', reg_com: 'J40/1/2020', is_vat_payer: true, address: 'Str. X 1', city: 'Sector 3', county: 'București', country: 'RO', email: 'facturi@client.ro' }
  const body = invoicePayload(SB, { client, currency: 'RON', amount: 199, issueDate: '2027-01-15', dueDate: '2027-01-25', line: 'Servicii Hontrio', mentions: 'm' })
  assert.equal(body.companyVatCode, '43474393')
  assert.equal(body.seriesName, 'HON')
  assert.equal(body.dueDate, '2027-01-25')
  assert.equal(body.language, 'RO')
  assert.equal(body.paymentUrl, 'Generate URL')
  assert.equal(body.sendEmail, false)
  const c = body.client as Record<string, unknown>
  assert.equal(c.vatCode, 'RO18547290')
  assert.equal(c.isTaxPayer, true)
  assert.equal(c.country, 'RO')
  const [p] = body.products as Record<string, unknown>[]
  assert.equal(p.price, 199)
  assert.equal(p.isService, true)
  assert.equal(p.measuringUnitName, 'buc')
  assert.ok(!('taxName' in p) && !('taxPercentage' in p), 'emitentul nu e plătitor de TVA')

  const foreign = invoicePayload({ ...SB, cardLink: false }, { client: { ...client, country: 'DE', vat_code: 'DE123456789', county: null, reg_com: null }, currency: 'EUR', amount: 39, issueDate: '2027-01-15', dueDate: '2027-01-25', line: 'Hontrio services', mentions: 'm' })
  assert.equal(foreign.language, 'EN')
  assert.ok(!('paymentUrl' in foreign))
  assert.ok(!('county' in (foreign.client as object)) && !('regCom' in (foreign.client as object)))
})

test('datele firmei: CUI cu cifra de control, sectorul în București, codul străin', () => {
  const base = { country: 'RO', name: 'Client SRL', vat_code: 'RO 18547290', address: 'Str. X 1', city: 'Craiova', county: 'Dolj', email: 'Facturi@Client.ro', is_vat_payer: true }
  const ok = checkProfile(base)
  assert.ok(ok.ok)
  if (ok.ok) {
    assert.equal(ok.profile.vat_code, '18547290')
    assert.equal(ok.profile.email, 'facturi@client.ro')
  }
  assert.deepEqual(checkProfile({ ...base, vat_code: '18547291' }), { ok: false, error: 'billing.err_cui', field: 'vat_code' })
  assert.deepEqual(checkProfile({ ...base, county: 'București', city: 'București' }), { ok: false, error: 'billing.err_sector', field: 'city' })
  const sector = checkProfile({ ...base, county: 'București', city: 'sector 3' })
  assert.ok(sector.ok && sector.profile.city === 'Sector 3')
  assert.deepEqual(checkProfile({ ...base, county: '' }), { ok: false, error: 'billing.err_county', field: 'county' })
  assert.deepEqual(checkProfile({ ...base, email: 'nu' }), { ok: false, error: 'billing.err_email', field: 'email' })
  const de = checkProfile({ ...base, country: 'DE', vat_code: 'DE123456789', county: '' })
  assert.ok(de.ok && de.profile.vat_code === 'DE123456789')
  assert.deepEqual(checkProfile({ ...base, country: 'DE', vat_code: '12' }), { ok: false, error: 'billing.err_vat', field: 'vat_code' })
})

test('e-mailurile facturării au textele în ambele limbi, cu sumele și datele', () => {
  for (const locale of ['ro', 'en'] as const) {
    const t = tIn(locale)
    const mails = [
      noticeMail(t, { start: '18 decembrie 2026' }),
      invoiceMail(t, { store: 'MH Tools', month: 'decembrie 2026', amount: '199 lei', due: '25 ianuarie 2027', number: 'HON 12', viewUrl: 'https://v', payUrl: 'https://p' }),
      invoiceMail(t, { store: 'MH Tools', month: 'decembrie 2026', amount: '199 lei', due: '25 ianuarie 2027', number: 'HON 12', viewUrl: 'https://v', payUrl: null }),
      dueReminderMail(t, { number: 'HON 12', amount: '199 lei', due: '25 ianuarie 2027', payUrl: null }),
      finalReminderMail(t, { number: 'HON 12', amount: '199 lei', store: 'MH Tools', suspendOn: '8 februarie 2027', payUrl: 'https://p' }),
      suspendedMail(t, { number: 'HON 12', store: 'MH Tools', payUrl: null }),
      paidMail(t, { number: 'HON 12', resumed: true }),
      profileMissingMail(t, { store: 'MH Tools', month: 'decembrie 2026', amount: '199 lei' }),
    ]
    for (const m of mails) {
      for (const text of [m.subject, m.title, ...m.paragraphs, m.cta.label]) {
        assert.ok(text && !text.startsWith('billing.') && !text.includes('{{'), `${locale}: ${text}`)
      }
    }
    assert.ok(mails[1].paragraphs.join(' ').includes('HON 12'))
    assert.equal(mails[1].cta.href, 'https://p', 'plata cu cardul întâi')
    assert.equal(mails[2].cta.href, 'https://v')
    assert.ok(mails[4].paragraphs[0].includes('8 februarie 2027'))
  }
})

test('SmartBill: o factură creată cu o eroare (linkul de plată) rămâne emisă, ca să nu se emită de două ori', async () => {
  const inv = {
    client: { name: 'Client SRL', vat_code: '18547290', reg_com: null, is_vat_payer: false, address: 'Str. X 1', city: 'Craiova', county: 'Dolj', country: 'RO', email: 'f@client.ro' },
    currency: 'RON' as const, amount: 199, issueDate: '2027-01-15', dueDate: '2027-01-25', line: 'Servicii Hontrio', mentions: 'm',
  }
  const replies = [
    json({ errorText: '', number: '0001', series: 'HON', url: 'https://pay.example/1', documentViewUrl: 'https://view.example/1' }),
    // Văzut pe contul real: documentul există (are număr), dar SmartBill raportează eroarea linkului
    json({ errorText: 'A aparut o eroare la generarea linkului de plata. Incearca din nou.', number: '0002', series: 'HON', url: '', documentViewUrl: 'https://view.example/2' }),
    json({ errorText: 'Seria nu a fost gasita! Folositi o serie creata in contul de cloud.', number: '', series: '', documentId: -1 }, 400),
  ]
  const net = stubNetwork(() => replies.shift()!)
  try {
    const ok = await createInvoice(SB, inv)
    assert.deepEqual(ok, { series: 'HON', number: '0001', viewUrl: 'https://view.example/1', payUrl: 'https://pay.example/1', warning: null })

    const noLink = await createInvoice(SB, inv)
    assert.equal(noLink.number, '0002')
    assert.equal(noLink.payUrl, null)
    assert.equal(noLink.warning, 'A aparut o eroare la generarea linkului de plata. Incearca din nou.')

    await assert.rejects(() => createInvoice(SB, inv), (err: unknown) => err instanceof SmartBillError && err.status === 400 && /Seria nu a fost gasita/.test(err.message))

    assert.equal(net.calls[0].url.pathname, '/SBORO/api/invoice/v2')
    assert.equal(net.calls[0].method, 'POST')
    assert.match(net.calls[0].headers.get('authorization') ?? '', /^Basic /)
  } finally {
    net.restore()
  }
})
