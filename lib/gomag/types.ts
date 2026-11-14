// =============================================
// Gomag — ce citește Hontrio din API-ul public (https://apidocs.gomag.ro),
// doar câmpurile folosite. API-ul dă numerele de obicei ca șiruri ("19",
// "1000.0000") și listele ca obiecte cu id-ul drept cheie; tipurile le
// acceptă pe amândouă. ⚠ Comenzile vin cu datele cumpărătorului (nume,
// telefon, e-mail, adrese): tipul le lasă dinadins pe dinafară, iar maparea
// păstrează doar țara.
// =============================================

export type NumLike = string | number | null | undefined

export type GomagCategory = { id?: string | number; name?: string }

export type GomagVariation = {
  id: string | number
  sku?: string | null
  base_price?: NumLike
  price?: NumLike
  stock?: NumLike
  stockStatus?: string | null
  stockManagement?: NumLike
  versionAttributes?: Record<string, { id?: string | number; name?: string; value?: string }> | null
}

export type GomagProduct = {
  id: string | number
  sku?: string | null
  name?: string | null
  url?: string | null
  canonical_url?: string | null
  brand?: string | null
  /** Ramurile categoriilor: fiecare e calea de la rădăcină la categoria produsului. */
  categories?: Record<string, GomagCategory[]> | GomagCategory[][] | null
  /** Activ în magazin: "1" / "0" */
  enabled?: NumLike
  /** Produsul principal al grupului de variante (pentru un produs simplu, el însuși). */
  parent?: string | number | null
  parent_sku?: string | null
  group_key?: string | null
  stockManagement?: NumLike
  stock?: NumLike
  /** instock / notinstock / preorder ... (documentația scrie și stockStatus) */
  stock_status?: string | null
  stockStatus?: string | null
  allowOrdersWhenOutOfStock?: NumLike
  base_price?: NumLike
  /** Prețul de vânzare, după adaosuri și reduceri */
  price?: NumLike
  vat_included?: NumLike
  vat?: NumLike
  currency?: string | null
  images?: string[] | null
  ean?: string | null
  attributes?: { id?: string | number; type?: string; name?: string; value?: string | string[] }[] | null
  variations?: GomagVariation[] | null
  updated?: string | null
  created?: string | null
}

export type GomagOrderItem = {
  id?: string | number | null
  /** product / service */
  type?: string | null
  sku?: string | null
  ean?: string | null
  name?: string | null
  /** Prețul plătit pe bucată */
  price?: NumLike
  /** Prețul întreg, dinaintea reducerii */
  baseprice?: NumLike
  /** Cota TVA, în procente */
  vat?: NumLike
  quantity?: NumLike
}

export type GomagOrder = {
  id: string | number
  number?: string | null
  /** Ora locală: "2022-10-24 14:42:21" */
  date?: string | null
  total?: NumLike
  status?: string | null
  statusId?: string | number | null
  /** internal / external */
  source?: string | null
  /** Website / EasySales / eMAG ... */
  sales_channel?: string | null
  currency?: string | null
  payment?: { name?: string | null; online?: NumLike; completed?: NumLike } | null
  delivery?: { name?: string | null; total?: NumLike } | null
  shipping?: { country?: string | null } | null
  billing?: { country?: string | null } | null
  items?: GomagOrderItem[] | Record<string, GomagOrderItem> | null
  discounts?: { value?: NumLike; name?: string | null; voucher?: string | null }[] | null
  updated?: string | null
}

export type GomagStatus = { id: string | number; name?: string | null; key?: string | null; type?: string | null }

export type GomagCurrency = { name?: string | null; currency?: string | null; multiplier?: NumLike }

/** O pagină din listele Gomag (produse, comenzi). */
export type GomagPage<T> = { items: T[]; total: number; page: number; pages: number }
