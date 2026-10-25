// =============================================
// Contractul API-ului Edinio pentru Hontrio (/api/hontrio/v1/*)
// Sursa: docs/hontrio/CONECTOR.md în repo-ul Edinio. Câmpurile sunt în
// română fiindcă așa le scrie Edinio; aici doar le descriem.
// =============================================

export type EdinioStore = {
  id: string
  nume: string
  url: string
  publicat: boolean
  moneda: string
  tara: string
  limba: string
  fus_orar: string
  preturi_cu_tva: boolean
  google_merchant: {
    conectat: true
    cont_id: string | null
    nume_cont: string | null
    tara: string
    limba: string
    eticheta_feed: string
  } | null
  google_ads: {
    tag_id: string | null
    conversie_id: string | null
    conversie_eticheta: string | null
    /** Conversia trimite și coșul (produsele, fără TVA): cu costul din Merchant Center, Google arată profitul brut. */
    cos?: boolean
  } | null
  google_analytics: { masurare_id: string } | null
}

export type EdinioOffer = {
  id: string                // = offerId din Merchant Center
  grup_id: string | null    // itemGroupId (ID-ul produsului) la variante
  varianta: string | null
  titlu: string
  url: string
  imagine: string | null
  pret: number
  pret_vechi: number | null
  disponibil: boolean
  stoc: number | null       // null = stoc neurmărit
  sku: string | null
  gtin: string | null
  mpn: string | null
  brand: string | null
  etichete: Record<string, string>
  stare_google: string | null
}

export type EdinioProduct = {
  id: string
  nume: string
  activ: boolean
  categorie: string | null
  pachet: boolean
  creat_la: string
  actualizat_la: string
  oferte: EdinioOffer[]
  fara_oferte: 'pret_neconfirmat' | null
}

export type EdinioOrderLine = {
  produs_id: string | null
  oferta_id: string | null
  nume: string
  varianta: string | null
  cantitate: number
  pret: number
  extra: boolean
}

export type EdinioOrder = {
  id: string
  numar: string
  creata_la: string
  actualizata_la: string
  stare: string
  stare_plata: string
  metoda_plata: string | null
  canal: string
  moneda: string
  subtotal: number
  transport: number
  reducere_cupon: number
  reducere_oferte: number
  reducere_card: number
  reducere_ramburs: number
  taxa_ramburs: number
  tva: number
  total: number
  cod_reducere: string | null
  tara: string
  sursa: Record<string, string | boolean>
  linii: EdinioOrderLine[]
}

export type EdinioPage<K extends string, T> = { [key in K]: T[] } & { urmatorul: string | null }
