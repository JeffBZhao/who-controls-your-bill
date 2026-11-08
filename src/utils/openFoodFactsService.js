import { WhoControlsYourBillDB } from '../db/database.js'
import { resolveEntity } from './corporateResolver.js'

const COMMUNITY_MAPPINGS_URL = `${import.meta.env.BASE_URL}community-sku-mappings.json`
const BRAND_PARENTS = [
  { names: ['tide', 'pampers', 'gillette', 'crest', 'charmin'], parent: 'The Procter & Gamble Company', ticker: 'PG' },
  { names: ['danone', 'activia', 'oikos', 'silk'], parent: 'Danone S.A.', ticker: 'BN.PA' },
  { names: ['saputo', 'dairyland', 'armstrong'], parent: 'Saputo Inc.', ticker: 'SAP.TO' },
  { names: ['hellmanns', 'knorr', 'ben and jerrys'], parent: 'Unilever PLC', ticker: 'UL' },
  { names: ['pepsi', 'lays', 'gatorade', 'quaker'], parent: 'PepsiCo, Inc.', ticker: 'PEP' },
  { names: ['coca cola', 'sprite', 'fanta'], parent: 'The Coca-Cola Company', ticker: 'KO' },
  { names: ['kraft', 'heinz', 'philadelphia'], parent: 'The Kraft Heinz Company', ticker: 'KHC' },
  { names: ['cheerios', 'nature valley', 'old el paso'], parent: 'General Mills, Inc.', ticker: 'GIS' },
  { names: ['burnbrae', 'maritime pride'], parent: 'Burnbrae Farms Ltd.', ticker: null },
]
let communityMappingsPromise

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function cleanName(value) {
  return String(value ?? '')
    .replace(/^\s*\d{3,}\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getItemKey(item) {
  const identifier = item?.sku ?? item?.barcode ?? item?.gtin
  return normalizeText(identifier || item?.standardized_name || item?.name || item?.description)
}

function getQueryKey(barcodeOrName) {
  return normalizeText(barcodeOrName)
}

async function loadCommunityMappings() {
  if (!communityMappingsPromise) {
    communityMappingsPromise = fetch(COMMUNITY_MAPPINGS_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load community SKU mappings (${response.status})`)
        }
        return response.json().then((mappings) => {
          if (!Array.isArray(mappings)) {
            throw new TypeError('Community SKU mappings must be a JSON array.')
          }
          return mappings.filter((mapping) => mapping && Array.isArray(mapping.match_keys))
        })
      })
      .catch((error) => {
        console.warn('Community SKU mappings could not be loaded; continuing without community matches.', error)
        return []
      })
  }
  return communityMappingsPromise
}

function matchCommunityMapping(item, merchantName, mappings) {
  const keys = [item?.sku, item?.barcode, item?.gtin, item?.raw_name, item?.name,
    item?.standardized_name, item?.description]
    .map(normalizeText)
    .filter(Boolean)
  const normalizedMerchant = normalizeText(merchantName)

  return mappings.find((mapping) => {
    const hint = normalizeText(mapping.merchant_hint)
    if (hint && hint !== 'any' && !normalizedMerchant.includes(hint)) return false
    return mapping.match_keys.some((key) => {
      const normalizedKey = normalizeText(key)
      return keys.some((value) => value === normalizedKey || value.includes(normalizedKey))
    })
  })
}

function mappingResult(mapping) {
  const candidates = Array.isArray(mapping.candidates) ? mapping.candidates : []
  const preferred = [...candidates].sort(
    (first, second) => Number(second.share_pct) - Number(first.share_pct),
  )[0]
  return {
    standardized_name: mapping.standardized_name,
    brand: preferred?.brand ?? '',
    parent_corporation: preferred?.parent_corporation ?? '',
    ticker: preferred?.ticker ?? null,
    gross_margin_pct: preferred?.gross_margin_pct,
    net_margin_pct: preferred?.net_margin_pct,
    candidates,
    source: 'community',
    isOverride: false,
  }
}

async function extractProductResult(product) {
  if (!product || typeof product !== 'object') return null
  const brand = String(product.brands ?? '')
    .split(',')[0]
    .trim() || String(product.brands_tags?.[0] ?? '').replace(/-/g, ' ').trim()
  if (!brand) return null

  const normalizedBrand = normalizeText(brand)
  const knownParent = BRAND_PARENTS.find(({ names }) =>
    names.some((name) => {
      const normalizedName = normalizeText(name)
      return normalizedBrand === normalizedName || normalizedBrand.includes(normalizedName)
    }),
  )
  const entity = await resolveEntity(
    knownParent?.ticker,
    knownParent?.parent ?? '',
    brand,
  )
  return {
    standardized_name: cleanName(product.product_name_en || product.product_name || brand),
    brand,
    parent_corporation: knownParent?.parent ??
      (normalizeText(entity.company_name) === normalizedBrand
        ? 'Unknown / Unclassified'
        : entity.company_name),
    ticker: entity.ticker,
    gross_margin_pct: entity.gross_margin_pct,
    net_margin_pct: entity.net_margin_pct,
    candidates: [],
    source: 'open_food_facts',
    isOverride: false,
  }
}

export async function lookupOpenFoodFacts(barcodeOrName) {
  const query = String(barcodeOrName ?? '').trim()
  if (!query) throw new TypeError('barcodeOrName must not be empty')

  const isBarcode = /^\d{8,}$/.test(query)
  const url = isBarcode
    ? `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(query)}.json`
    : `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(cleanName(query))}&fields=code,product_name,product_name_en,brands,brands_tags&sort_by=unique_scans_n&page_size=5`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Open Food Facts lookup failed (${response.status})`)
  }
  const payload = await response.json()
  const product = isBarcode
    ? payload.product
    : payload.products?.find((candidate) => candidate.brands || candidate.brands_tags?.length)
  const result = await extractProductResult(product)
  const queryKey = getQueryKey(query)
  try {
    await WhoControlsYourBillDB.off_cache.put({
      query_key: queryKey,
      result,
      fetched_at: new Date().toISOString(),
    })
  } catch (cacheError) {
    console.warn('Open Food Facts result could not be cached locally.', cacheError)
  }
  return result
}

export async function saveUserItemOverride(itemKey, override) {
  const normalizedKey = normalizeText(itemKey)
  if (!normalizedKey) throw new TypeError('itemKey must not be empty')

  const record = {
    item_key: normalizedKey,
    standardized_name: String(override?.standardized_name ?? '').trim(),
    brand: String(override?.brand ?? '').trim(),
    parent_corporation: String(override?.parent_corporation ?? '').trim(),
    ticker: String(override?.ticker ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  }
  await WhoControlsYourBillDB.user_item_overrides.put(record)
  return record
}

export async function resolveItem(item, merchantName = '') {
  const itemKey = getItemKey(item)
  if (!itemKey) return null

  let override
  try {
    override = await WhoControlsYourBillDB.user_item_overrides.get(itemKey)
  } catch (databaseError) {
    if (databaseError?.name !== 'VersionError') throw databaseError
    console.warn('Item overrides are unavailable in this database version; resolving from bundled data.')
  }
  const mappings = await loadCommunityMappings()
  const mapping = matchCommunityMapping(item, merchantName, mappings)
  if (override) {
    return {
      ...override,
      candidates: Array.isArray(mapping?.candidates) ? mapping.candidates : [],
      source: 'user_override',
      isOverride: true,
    }
  }
  if (mapping) return mappingResult(mapping)

  const query = item?.barcode ?? item?.gtin ?? item?.sku ??
    item?.standardized_name ?? item?.name ?? item?.description
  if (!query) return null
  const queryKey = getQueryKey(query)
  let cached
  try {
    cached = await WhoControlsYourBillDB.off_cache.get(queryKey)
  } catch (databaseError) {
    if (databaseError?.name !== 'VersionError') throw databaseError
    console.warn('Open Food Facts cache is unavailable in this database version.')
  }
  if (cached) return cached.result

  return null
}
