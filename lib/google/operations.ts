import { toMicros, type MutateOperation } from '@/lib/google/ads'

// =============================================
// Operațiile Google Ads API (REST v26) pe care le trimite Hontrio: lansarea
// unei campanii (Shopping standard la pornire, Performance Max doar pe feed
// la creștere) și modificările de după. Funcții pure: primesc tot ce le
// trebuie și întorc `mutateOperations`, deci se pot verifica fără Google.
//
// Câmpurile vin din definițiile oficiale v26 (googleapis/googleapis) și din
// exemplul `add_performance_max_retail_campaign` al Google. Vezi
// docs/campanii/SPECIFICATIE.md §3.
// =============================================

/** ID-uri temporare: negative și unice într-o cerere (ca în exemplele Google). */
const BUDGET = '-1'
const CAMPAIGN = '-2'
const GROUP = '-3'
const FIRST_NODE = -4

/** Ce produse intră: totul, o listă de ID-uri sau o etichetă pusă de Hontrio în Merchant Center. */
export type ListingSpec =
  | { kind: 'all' }
  | { kind: 'exclude_items'; item_ids: string[] }
  | { kind: 'include_items'; item_ids: string[] }
  | { kind: 'exclude_label'; index: number; value: string }
  | { kind: 'include_label'; index: number; value: string }

/** Filtre pe grup la Performance Max (limita Google: 1.000, cu rădăcina și „restul"). */
export const MAX_LISTING_ITEMS = 990

export type NegativeKeyword = { text: string; match: 'EXACT' | 'PHRASE' }

type Common = {
  customerId: string
  name: string
  merchantId: string
  feedLabel: string | null
  dailyBudget: number
  billableUnitMicros: number
  /** 'geoTargetConstants/2642' */
  geoTargetConstant: string
  finalUrlSuffix: string
  listing: ListingSpec
  negatives: NegativeKeyword[]
  /** Perioada campaniei, în fusul orar al contului ('yyyy-MM-dd HH:mm:ss'); lipsă = de acum, fără sfârșit. */
  startDateTime?: string | null
  endDateTime?: string | null
}

export type StarterSpec = Common & {
  kind: 'shopping'
  /** Plafonul pe click al „Maximizează clicurile"; null = fără plafon. */
  cpcCeiling: number | null
  /** 0 când omul își păstrează campaniile Shopping (ale lui au întâietate), altfel 1. */
  campaignPriority: 0 | 1
}

/** Performance Max cu „Maximizează valoarea conversiilor", fără ROAS țintă. */
export type GrowthSpec = Common & {
  kind: 'performance_max'
  /** 'languageConstants/1032'; null = toate limbile */
  languageConstant: string | null
  /** Adresa magazinului, pentru grupul de materiale (ca în exemplul Google). */
  finalUrl: string
  /** Obiectivele de conversie ale contului: numai PURCHASE~WEBSITE rămâne licitabil. */
  goals: { category: string; origin: string }[]
}

export type LaunchSpec = StarterSpec | GrowthSpec

const customerPath = (cid: string) => `customers/${cid}`
const budgetPath = (cid: string, id: string) => `${customerPath(cid)}/campaignBudgets/${id}`
export const campaignPath = (cid: string, id: string) => `${customerPath(cid)}/campaigns/${id}`
const adGroupPath = (cid: string, id: string) => `${customerPath(cid)}/adGroups/${id}`
const assetGroupPath = (cid: string, id: string) => `${customerPath(cid)}/assetGroups/${id}`
const filterPath = (cid: string, group: string, id: string) => `${customerPath(cid)}/assetGroupListingGroupFilters/${group}~${id}`
const criterionPath = (cid: string, group: string, id: string) => `${customerPath(cid)}/adGroupCriteria/${group}~${id}`

/** UTM-urile Hontrio: o comandă cu utm_campaign „hontrio-<id>" e a campaniei noastre. */
export const FINAL_URL_SUFFIX = 'utm_source=google&utm_medium=cpc&utm_campaign=hontrio-{campaignid}'

/** Google compară ID-urile produselor fără să țină cont de litere mari (le raportează cu mici). */
export const normalizeItemId = (id: string) => id.trim().toLowerCase()

/** Eticheta Hontrio pentru ofertele scoase din campanie, la cataloagele prea mari pentru lista de ID-uri. */
export const EXCLUDE_LABEL = 'hontrio_exclude'

/** Limitele Google pentru textul unui cuvânt cheie (KEYWORD_TEXT_TOO_LONG, KEYWORD_HAS_TOO_MANY_WORDS). */
export const KEYWORD_MAX_CHARS = 80
export const KEYWORD_MAX_WORDS = 10

/**
 * Un termen de căutare, ca text de cuvânt cheie pe care Google îl primește: doar litere, cifre și
 * câteva semne permise (& ' . -), cel mult 10 cuvinte și 80 de caractere, tăiat la un cuvânt întreg.
 * Un singur termen invalid ar strica toată cererea (e atomică); unul care rămâne gol se sare.
 */
export function cleanKeyword(raw: string): string {
  const words = raw.normalize('NFC').toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}&'.\-\s]/gu, ' ')
    .split(/\s+/)
    // Semnele de la capete nu țin de cuvânt („led-", „.5")
    .map(w => w.replace(/^[&'.-]+|[&'.-]+$/g, ''))
    .filter(Boolean)
    .slice(0, KEYWORD_MAX_WORDS)
  let text = ''
  for (const w of words) {
    const next = text ? `${text} ${w}` : w
    if (next.length > KEYWORD_MAX_CHARS) break
    text = next
  }
  return text
}

const customAttribute = (index: number, value?: string) => ({ index: `INDEX${index}`, ...(value !== undefined ? { value } : {}) })

// ─── Arborele de produse ──────────────────────────────────────────────────────

type Node = { parent: string | null; type: 'SUBDIVISION' | 'UNIT'; included: boolean; caseValue?: Record<string, unknown> }

/** Nodurile arborelui, în ordinea creării (părintele înaintea copiilor). */
function listingNodes(listing: ListingSpec, root: string, nextId: () => string): (Node & { id: string })[] {
  const nodes: (Node & { id: string })[] = []
  if (listing.kind === 'all'
    || ((listing.kind === 'exclude_items') && !listing.item_ids.length)) {
    nodes.push({ id: root, parent: null, type: 'UNIT', included: true })
    return nodes
  }
  nodes.push({ id: root, parent: null, type: 'SUBDIVISION', included: true })
  if (listing.kind === 'exclude_items' || listing.kind === 'include_items') {
    const include = listing.kind === 'include_items'
    for (const item of [...new Set(listing.item_ids.map(normalizeItemId))]) {
      nodes.push({ id: nextId(), parent: root, type: 'UNIT', included: include, caseValue: { productItemId: { value: item } } })
    }
    // „Restul": aceeași dimensiune, fără valoare
    nodes.push({ id: nextId(), parent: root, type: 'UNIT', included: !include, caseValue: { productItemId: {} } })
  } else {
    const include = listing.kind === 'include_label'
    nodes.push({ id: nextId(), parent: root, type: 'UNIT', included: include, caseValue: { productCustomAttribute: customAttribute(listing.index, listing.value) } })
    nodes.push({ id: nextId(), parent: root, type: 'UNIT', included: !include, caseValue: { productCustomAttribute: customAttribute(listing.index) } })
  }
  return nodes
}

function counter(start: number) {
  let next = start
  return () => String(next--)
}

/** Arborele unui grup de materiale Performance Max. */
export function pmaxListingOps(cid: string, assetGroupId: string, listing: ListingSpec, firstTemp = FIRST_NODE): MutateOperation[] {
  const nextId = counter(firstTemp)
  const root = nextId()
  return listingNodes(listing, root, nextId).map(n => ({
    assetGroupListingGroupFilterOperation: {
      create: {
        ...(n.type === 'SUBDIVISION' ? { resourceName: filterPath(cid, assetGroupId, n.id) } : {}),
        assetGroup: assetGroupPath(cid, assetGroupId),
        type: n.type === 'SUBDIVISION' ? 'SUBDIVISION' : n.included ? 'UNIT_INCLUDED' : 'UNIT_EXCLUDED',
        listingSource: 'SHOPPING',
        ...(n.caseValue ? { caseValue: n.caseValue } : {}),
        ...(n.parent ? { parentListingGroupFilter: filterPath(cid, assetGroupId, n.parent) } : {}),
      },
    },
  }))
}

/** Oferta pe nod când campania n-are plafon pe click (o unitate din moneda contului). */
export const LISTING_BID_FALLBACK = 1

/**
 * Oferta pe nodurile care licitează, la Shopping standard. Google o cere pe fiecare unitate
 * inclusă (fieldError.REQUIRED la cpc_bid_micros, văzut la validarea primului client), deși
 * „Maximizează clicurile" licitează singur, în limita plafonului. Punem chiar plafonul, ca nodul
 * să nu poată licita peste el nici dacă cineva trece campania pe CPC manual.
 */
export function listingBidMicros(cpcCeiling: number | null, billableUnitMicros?: number): string {
  return toMicros(cpcCeiling ?? LISTING_BID_FALLBACK, billableUnitMicros)
}

/**
 * Arborele unui grup de anunțuri Shopping standard: excluderile sunt noduri negative, fără ofertă;
 * unitățile incluse au oferta `bidMicros` (vezi `listingBidMicros`).
 */
export function shoppingListingOps(cid: string, adGroupId: string, listing: ListingSpec, bidMicros: string, firstTemp = FIRST_NODE): MutateOperation[] {
  const nextId = counter(firstTemp)
  const root = nextId()
  return listingNodes(listing, root, nextId).map(n => ({
    adGroupCriterionOperation: {
      create: {
        ...(n.type === 'SUBDIVISION' ? { resourceName: criterionPath(cid, adGroupId, n.id) } : {}),
        adGroup: adGroupPath(cid, adGroupId),
        status: 'ENABLED',
        ...(n.type === 'UNIT' && !n.included ? { negative: true } : {}),
        ...(n.type === 'UNIT' && n.included ? { cpcBidMicros: bidMicros } : {}),
        listingGroup: {
          type: n.type,
          ...(n.caseValue ? { caseValue: n.caseValue } : {}),
          ...(n.parent ? { parentAdGroupCriterion: criterionPath(cid, adGroupId, n.parent) } : {}),
        },
      },
    },
  }))
}

// ─── Lansarea ─────────────────────────────────────────────────────────────────

function negativeOps(cid: string, campaign: string, negatives: NegativeKeyword[]): MutateOperation[] {
  const seen = new Set<string>()
  return negatives.flatMap(k => {
    const text = cleanKeyword(k.text)
    const key = `${k.match}:${text}`
    if (!text || seen.has(key)) return []
    seen.add(key)
    return [{ campaignCriterionOperation: { create: { campaign, negative: true, keyword: { text, matchType: k.match } } } }]
  })
}

/**
 * Toate operațiile campaniei, într-o singură cerere atomică: bugetul, campania,
 * țintirea, grupul (de anunțuri sau de materiale), arborele de produse și,
 * la Performance Max, obiectivele de conversie.
 */
export function buildLaunchOperations(spec: LaunchSpec): MutateOperation[] {
  const cid = spec.customerId
  const campaign = campaignPath(cid, CAMPAIGN)
  const ops: MutateOperation[] = []

  ops.push({
    campaignBudgetOperation: {
      create: {
        resourceName: budgetPath(cid, BUDGET),
        name: spec.name,
        amountMicros: toMicros(spec.dailyBudget, spec.billableUnitMicros),
        deliveryMethod: 'STANDARD',
        // PMax nu acceptă bugete partajate, iar implicitul la creare e „partajat"
        explicitlyShared: false,
      },
    },
  })

  const common = {
    resourceName: campaign,
    name: spec.name,
    status: 'ENABLED',
    campaignBudget: budgetPath(cid, BUDGET),
    geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE' },
    containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    finalUrlSuffix: spec.finalUrlSuffix,
    // Campaniile de promoție: Google le pornește și le oprește singur, la secundă
    ...(spec.startDateTime ? { startDateTime: spec.startDateTime } : {}),
    ...(spec.endDateTime ? { endDateTime: spec.endDateTime } : {}),
  }
  const shoppingSetting = { merchantId: spec.merchantId, ...(spec.feedLabel ? { feedLabel: spec.feedLabel } : {}) }

  if (spec.kind === 'shopping') {
    ops.push({
      campaignOperation: {
        create: {
          ...common,
          advertisingChannelType: 'SHOPPING',
          shoppingSetting: { ...shoppingSetting, campaignPriority: spec.campaignPriority },
          // „Maximizează clicurile": Google licitează singur în limita bugetului, cu plafonul nostru pe click
          targetSpend: spec.cpcCeiling ? { cpcBidCeilingMicros: toMicros(spec.cpcCeiling, spec.billableUnitMicros) } : {},
          networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false },
        },
      },
    })
  } else {
    ops.push({
      campaignOperation: {
        create: {
          ...common,
          advertisingChannelType: 'PERFORMANCE_MAX',
          shoppingSetting,
          // Fără ROAS țintă: Google aduce cea mai mare valoare a vânzărilor din buget
          maximizeConversionValue: {},
          // Clicurile duc la pagina produsului: fără extinderea URL-ului final
          assetAutomationSettings: [
            { assetAutomationType: 'FINAL_URL_EXPANSION_TEXT_ASSET_AUTOMATION', assetAutomationStatus: 'OPTED_OUT' },
          ],
        },
      },
    })
  }

  ops.push({ campaignCriterionOperation: { create: { campaign, location: { geoTargetConstant: spec.geoTargetConstant } } } })
  if (spec.kind === 'performance_max' && spec.languageConstant) {
    ops.push({ campaignCriterionOperation: { create: { campaign, language: { languageConstant: spec.languageConstant } } } })
  }
  ops.push(...negativeOps(cid, campaign, spec.negatives))

  if (spec.kind === 'shopping') {
    ops.push({
      adGroupOperation: {
        create: {
          resourceName: adGroupPath(cid, GROUP),
          campaign,
          name: spec.name,
          status: 'ENABLED',
          type: 'SHOPPING_PRODUCT_ADS',
        },
      },
    })
    ops.push({ adGroupAdOperation: { create: { adGroup: adGroupPath(cid, GROUP), status: 'ENABLED', ad: { shoppingProductAd: {} } } } })
    ops.push(...shoppingListingOps(cid, GROUP, spec.listing, listingBidMicros(spec.cpcCeiling, spec.billableUnitMicros)))
  } else {
    ops.push({
      assetGroupOperation: {
        create: {
          resourceName: assetGroupPath(cid, GROUP),
          campaign,
          name: spec.name,
          status: 'ENABLED',
          finalUrls: [spec.finalUrl],
          finalMobileUrls: [spec.finalUrl],
        },
      },
    })
    ops.push(...pmaxListingOps(cid, GROUP, spec.listing))
    // Numai cumpărarea pe site e licitabilă în campanie (restul obiectivelor contului, nu)
    for (const g of spec.goals) {
      ops.push({
        campaignConversionGoalOperation: {
          update: {
            resourceName: `${customerPath(cid)}/campaignConversionGoals/${CAMPAIGN}~${g.category}~${g.origin}`,
            biddable: g.category === 'PURCHASE' && g.origin === 'WEBSITE',
          },
          updateMask: 'biddable',
        },
      })
    }
  }
  return ops
}

/** ID-urile resurselor create, citite din răspunsul lansării (în ordinea operațiilor). */
export type LaunchIds = { budget: string | null; campaign: string | null; group: string | null }

// ─── Modificările de după lansare ─────────────────────────────────────────────

export function campaignStatusOp(cid: string, campaignId: string, status: 'ENABLED' | 'PAUSED'): MutateOperation {
  return { campaignOperation: { update: { resourceName: campaignPath(cid, campaignId), status }, updateMask: 'status' } }
}

export function budgetOp(cid: string, budgetId: string, amount: number, billableUnitMicros: number): MutateOperation {
  return {
    campaignBudgetOperation: {
      update: { resourceName: budgetPath(cid, budgetId), amountMicros: toMicros(amount, billableUnitMicros) },
      updateMask: 'amountMicros',
    },
  }
}

/** Ziua de început / de sfârșit ca dată-oră Google: de la 00:00:00, până la 23:59:59 (granularitate de zi). */
export const startOfDay = (day: string) => `${day} 00:00:00`
export const endOfDay = (day: string) => `${day} 23:59:59`

/** Sfârșitul campaniei; null = rulează fără sfârșit (câmpul se golește). */
export function endDateOp(cid: string, campaignId: string, endDateTime: string | null): MutateOperation {
  return {
    campaignOperation: {
      update: { resourceName: campaignPath(cid, campaignId), ...(endDateTime ? { endDateTime } : {}) },
      updateMask: 'endDateTime',
    },
  }
}

/** Declarația UE pe campaniile omului: o modificare doar a acestui câmp trece chiar când contul e blocat. */
export function euDeclarationOps(cid: string, campaignIds: string[]): MutateOperation[] {
  return campaignIds.map(id => ({
    campaignOperation: {
      update: { resourceName: campaignPath(cid, id), containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' },
      updateMask: 'containsEuPoliticalAdvertising',
    },
  }))
}

export function addNegativesOps(cid: string, campaignId: string, negatives: NegativeKeyword[]): MutateOperation[] {
  return negativeOps(cid, campaignPath(cid, campaignId), negatives)
}

/** Un nod existent al arborelui, citit cu GAQL. */
export type ExistingNode = { resourceName: string; parent: string | null }

/**
 * Arborele se reface întreg, într-o cerere: întâi se scot nodurile vechi (frunzele
 * înaintea părinților), apoi se creează cel nou. Tipul nodului e imuabil, deci
 * „totul" nu poate deveni „totul minus ceva" altfel.
 */
export function removeNodesOps(nodes: ExistingNode[], operation: 'assetGroupListingGroupFilterOperation' | 'adGroupCriterionOperation'): MutateOperation[] {
  const depth = new Map<string, number>()
  const byName = new Map(nodes.map(n => [n.resourceName, n]))
  const depthOf = (n: ExistingNode): number => {
    if (depth.has(n.resourceName)) return depth.get(n.resourceName)!
    const parent = n.parent ? byName.get(n.parent) : undefined
    const d = parent ? depthOf(parent) + 1 : 0
    depth.set(n.resourceName, d)
    return d
  }
  return [...nodes]
    .sort((a, b) => depthOf(b) - depthOf(a))
    .map(n => ({ [operation]: { remove: n.resourceName } }))
}
