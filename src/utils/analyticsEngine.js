import { resolveEntity } from './corporateResolver.js'
import { resolveItem } from './openFoodFactsService.js'

const UNCLASSIFIED_NAME = 'Unknown / Unclassified'
const UNMAPPED_PARENT = 'Independent / Unmapped Agribusiness'
const UNKNOWN_ENTITY = {
  company_name: UNCLASSIFIED_NAME,
  sector: 'Unknown',
  gross_margin_pct: 30,
  net_margin_pct: 8,
  ticker: null,
}
const TAX_OR_FEE_PATTERN = /\b(?:hst|gst|pst|qst|vat)\b|sales\s+tax|tax\b|bottle\s+deposit|deposit|env\s+fee|recycling\s+fee|bag\s+fee|eco\s+fee|environmental|handling\s+fee|ehf\b/i
const ATTRIBUTION_MODES = ['split_50_50', 'value_chain', 'upstream_only', 'retailer_only']
const RETAILER_TICKERS = [
  { ticker: 'COST', names: ['costco'] },
  { ticker: 'L.TO', names: ['loblaw', 'atlantic superstore', 'real canadian superstore', 'no frills'] },
  { ticker: 'WMT', names: ['walmart'] },
  { ticker: 'EMP-A.TO', names: ['sobeys', 'freshco', 'foodland'] },
  { ticker: 'MRU.TO', names: ['metro', 'food basics'] },
  { ticker: 'DOL.TO', names: ['dollarama'] },
]

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function getDateBounds(dateFilter) {
  if (!dateFilter || typeof dateFilter !== 'object') return {}

  return {
    start: dateFilter.startDate ?? dateFilter.start ?? dateFilter.from,
    end: dateFilter.endDate ?? dateFilter.end ?? dateFilter.to,
    month: dateFilter.month,
  }
}

function matchesDateFilter(bill, bounds) {
  const date = String(bill.date ?? '').slice(0, 10)
  if (!date) return false
  if (bounds.start && date < String(bounds.start).slice(0, 10)) return false
  if (bounds.end && date > String(bounds.end).slice(0, 10)) return false
  if (bounds.month && date.slice(0, 7) !== String(bounds.month).slice(0, 7)) {
    return false
  }
  return true
}

function getBillAmounts(bill, items) {
  const itemSubtotal = items.reduce(
    (sum, item) => sum + toNumber(item.total_price, toNumber(item.unit_price) * toNumber(item.quantity, 1)),
    0,
  )
  const subtotal = toNumber(
    bill.summary?.subtotal ?? bill.summary?.subtotalSpent ?? bill.subtotal,
    itemSubtotal,
  )
  const tax = toNumber(bill.summary?.tax_total ?? bill.summary?.tax ?? bill.summary?.totalTax ?? bill.tax)
  const total = toNumber(bill.summary?.total ?? bill.total, subtotal + tax)

  return { subtotal, tax, total }
}

function getMerchant(bill) {
  const merchant = bill.merchant
  if (typeof merchant === 'string') {
    return {
      name: merchant,
      ticker: bill.merchant_ticker || bill.merchant_parent_ticker || findRetailerTicker(merchant),
      parentCorporation: bill.merchant_parent_corporation ?? '',
      parentTicker: bill.merchant_parent_ticker ?? null,
      channel: bill.bill_type ?? 'Other',
    }
  }

  return {
    name: merchant?.name ?? bill.merchant_name ?? 'Unknown merchant',
    ticker: merchant?.ticker || bill.merchant_ticker || merchant?.parent_ticker ||
      bill.merchant_parent_ticker || findRetailerTicker(merchant?.name ?? bill.merchant_name),
    parentCorporation:
      merchant?.parent_corporation ??
      bill.merchant_parent_corporation ??
      '',
    parentTicker:
      merchant?.parent_ticker ??
      bill.merchant_parent_ticker ??
      null,
    channel: merchant?.channel ?? bill.bill_type ?? 'Other',
  }
}

function getItemBrand(item) {
  return String(item.brand ?? item.name ?? item.standardized_name ?? 'Unbranded').trim()
}

function getItemDescription(item) {
  return String(item.standardized_name ?? item.name ?? item.description ?? '').trim()
}

function isFeeItem(item) {
  return TAX_OR_FEE_PATTERN.test([
    item.raw_name,
    item.standardized_name,
    item.name,
  ].filter(Boolean).join(' '))
}

function isGenericName(value) {
  const normalized = normalizeText(value)
  return !normalized || /^(unknown|generic|unbranded|unclassified)(?:\s|$)/.test(normalized) || /^(n a|na)$/.test(normalized)
}

function looksLikeUnbrandedProduct(item) {
  const brand = String(item.brand ?? '').trim()
  const description = getItemDescription(item)
  const rawText = `${brand} ${description}`.trim()
  const genericBrand = isGenericName(brand)
  const hasSkuPrefix = /^\s*\d{3,}\s/.test(rawText)
  const productWords = /\b(bananas?|tomatoes?|apples?|cucumbers?|corn|seaweed|salad|eggs?|milk|beef|chicken|pork|produce)\b/i
  const brandMatchesDescription =
    brand && description && normalizeText(brand) === normalizeText(description)

  return genericBrand || hasSkuPrefix || Boolean(brandMatchesDescription && productWords.test(description))
}

function findRetailerTicker(name) {
  const normalizedName = normalizeText(name)
  if (!normalizedName) return null
  return RETAILER_TICKERS.find(({ names }) =>
    names.some((candidate) => normalizedName.includes(normalizeText(candidate))),
  )?.ticker ?? null
}

function isUnknownEntity(entity) {
  return isGenericName(entity.company_name)
}

function sameEntity(first, second) {
  return Boolean(
    first &&
    second &&
    ((first.ticker && second.ticker && first.ticker === second.ticker) ||
      normalizeText(first.company_name) === normalizeText(second.company_name)),
  )
}

function getBrandDisplay(item, storeControlled) {
  let brand = String(item.brand ?? '').trim()
  if (!brand || isGenericName(brand) || /^\d{3,}\s/.test(brand)) {
    brand = getItemDescription(item) || brand || 'Unbranded item'
  }
  brand = brand.replace(/^\s*\d{3,}\s*/, '').trim()

  if (/\beggs?\b/i.test(brand) && /\b30\s*(?:units?|ct|count)\b/i.test(brand)) {
    brand = 'Fresh Eggs 30ct'
  } else if (/\bambrosia\b/i.test(brand) && /\bapp(?:le)?s?\b/i.test(brand)) {
    brand = 'Ambrosia Apples'
  }

  if (storeControlled && !/\(store-sourced\)$/i.test(brand)) {
    brand = `${brand} (Store-Sourced)`
  }
  return brand
}

function getItemAmount(item) {
  return toNumber(
    item.total_price,
    toNumber(item.unit_price) * toNumber(item.quantity, 1),
  )
}

function isDiscountItem(item) {
  return getItemAmount(item) < 0 ||
    /\b(?:discount|coupon|promotional savings)\b/i.test(
      [item.raw_name, item.standardized_name, item.name, item.description]
        .filter(Boolean)
        .join(' '),
    )
}

function getDiscountTarget(item) {
  return normalizeText(
    [item.raw_name, item.standardized_name, item.name, item.description]
      .filter(Boolean)
      .join(' ')
      .replace(/-?\$?\d+(?:\.\d{1,2})?/g, ' ')
      .replace(/\b(?:promotional|promotion|promo|discount|coupon|savings|on|for)\b/gi, ' '),
  )
}

function applyBillDiscounts(billItems) {
  const items = billItems.filter((item) => !isDiscountItem(item) && getItemAmount(item) > 0)
    .map((item) => ({ ...item }))
  let billLevelSavings = 0

  for (const discount of billItems.filter(isDiscountItem)) {
    const discountAmount = Math.abs(getItemAmount(discount))
    if (!discountAmount) continue

    const target = getDiscountTarget(discount)
    const parentItem = target
      ? items.find((item) => {
          const description = normalizeText(getItemDescription(item))
          return description.length > 3 &&
            (target.includes(description) || description.includes(target))
        })
      : null
    if (parentItem) {
      parentItem.total_price = Math.max(0, getItemAmount(parentItem) - discountAmount)
    } else {
      billLevelSavings += discountAmount
    }
  }

  return {
    items: items.filter((item) => getItemAmount(item) > 0),
    billLevelSavings,
  }
}

function getEntityKey(entity) {
  return entity.ticker || normalizeText(entity.company_name) || 'unknown'
}

function getParentName(item) {
  return item.parent_corporation ?? item.parent_company ?? item.parent ?? ''
}

function getTicker(item) {
  return item.ticker || item.parent_ticker || null
}

async function resolveRetailerParent(merchant) {
  const ticker = merchant.parentTicker || findRetailerTicker(merchant.name) || merchant.ticker
  const parentName = String(merchant.parentCorporation ?? '').trim()
  if (!ticker && !parentName) return null

  const entity = await resolveEntity(ticker, parentName, merchant.name)
  return isUnknownEntity(entity) ? null : entity
}

async function resolveItemEntity(item, retailerParent) {
  const ticker = getTicker(item)
  const parentName = getParentName(item)
  const brand = getItemBrand(item)
  const unbranded = looksLikeUnbrandedProduct(item)
  const resolvedEntity = await resolveEntity(ticker, parentName, brand)

  if (unbranded && (isGenericName(parentName) || isUnknownEntity(resolvedEntity) ||
    (retailerParent && sameEntity(resolvedEntity, retailerParent)))) {
    return {
      ...UNKNOWN_ENTITY,
      company_name: UNMAPPED_PARENT,
      sector: 'Agriculture & Food',
      gross_margin_pct: 12,
      net_margin_pct: 3,
      ticker: null,
    }
  }
  const resolved = isUnknownEntity(resolvedEntity)
    ? { ...resolvedEntity, company_name: UNCLASSIFIED_NAME, ticker: null }
    : resolvedEntity
  return {
    ...resolved,
    gross_margin_pct: item.gross_margin_pct ?? resolved.gross_margin_pct,
    net_margin_pct: item.net_margin_pct ?? resolved.net_margin_pct,
  }
}

function getAttributionParts(mode, spend, retailerParent, upstreamParent, isUnmappedUpstream) {
  const fallbackParent = retailerParent ?? upstreamParent
  if (mode === 'upstream_only') return [{ entity: upstreamParent, amount: spend }]
  if (mode === 'retailer_only') return [{ entity: fallbackParent, amount: spend }]

  if (isUnmappedUpstream) {
    return [
      ...(retailerParent ? [{ entity: retailerParent, amount: spend * 0.5 }] : []),
      { entity: upstreamParent, amount: retailerParent ? spend * 0.5 : spend },
    ]
  }
  if (!retailerParent || sameEntity(retailerParent, upstreamParent)) {
    return [{ entity: upstreamParent, amount: spend }]
  }

  const retailerPct = mode === 'split_50_50'
    ? 50
    : Math.max(0, Math.min(100, toNumber(retailerParent.gross_margin_pct)))
  return [
    { entity: retailerParent, amount: spend * retailerPct / 100 },
    { entity: upstreamParent, amount: spend * (100 - retailerPct) / 100 },
  ]
}

function formatRanking(ranking) {
  return [...ranking.values()]
    .map((entry) => ({
      ...entry,
      totalSpent: round(entry.totalSpent),
      sharePct: 0,
      itemCount: entry.itemCount,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
}

export async function analyzeBills(bills, dateFilter, attributionMode = 'value_chain') {
  if (!Array.isArray(bills)) {
    throw new TypeError('bills must be an array')
  }
  if (!ATTRIBUTION_MODES.includes(attributionMode)) {
    throw new TypeError(`attributionMode must be one of: ${ATTRIBUTION_MODES.join(', ')}`)
  }

  const bounds = getDateBounds(dateFilter)
  const filteredBills = bills.filter((bill) => matchesDateFilter(bill, bounds))
  const conglomerates = new Map()
  const merchants = new Map()
  const brands = new Map()
  const inflationItems = new Map()
  const monthlyTotals = new Map()
  const itemsInventory = new Map()
  let totalSpent = 0
  let subtotalSpent = 0
  let netItemSpend = 0
  let totalTax = 0
  let estGrossProfitExtracted = 0
  let estNetProfitExtracted = 0
  let billLevelSavings = 0
  const uniqueBrands = new Set()
  const uniqueConglomerates = new Set()

  for (const bill of filteredBills) {
    const allItems = Array.isArray(bill.items) ? bill.items : []
    const billItems = allItems.filter((item) => !isFeeItem(item))
    const { items, billLevelSavings: unmatchedSavings } = applyBillDiscounts(billItems)
    billLevelSavings += unmatchedSavings
    netItemSpend += items.reduce((sum, item) => sum + getItemAmount(item), 0) - unmatchedSavings
    const filteredTaxAmount = Number(bill.summary?.tax_total) === 0
      ? allItems.filter(isFeeItem).reduce((sum, item) => sum + getItemAmount(item), 0)
      : 0
    const { subtotal, tax, total } = getBillAmounts(bill, billItems)
    const billTax = tax + filteredTaxAmount
    const hasBillTotal = bill.summary?.total !== undefined || bill.total !== undefined
    totalSpent += total + (!hasBillTotal ? filteredTaxAmount : 0)
    subtotalSpent += subtotal
    totalTax += billTax

    const month = String(bill.date).slice(0, 7)
    if (!monthlyTotals.has(month)) {
      monthlyTotals.set(month, {
        month,
        subtotalSpent: 0,
        corporateGrossProfit: 0,
        tax: 0,
      })
    }
    const monthly = monthlyTotals.get(month)
    monthly.subtotalSpent += subtotal
    monthly.tax += billTax

    const merchant = getMerchant(bill)
    const retailerParent = await resolveRetailerParent(merchant)
    const merchantKey = `${normalizeText(merchant.name)}|${normalizeText(merchant.channel)}`
    if (!merchants.has(merchantKey)) {
      merchants.set(merchantKey, {
        key: merchantKey,
        name: merchant.name,
        ticker: merchant.ticker,
        channel: merchant.channel,
        totalSpent: 0,
        billCount: 0,
        itemCount: 0,
      })
    }
    const merchantEntry = merchants.get(merchantKey)
    merchantEntry.totalSpent += total
    merchantEntry.billCount += 1
    merchantEntry.itemCount += items.length

    for (const item of items) {
      const amount = getItemAmount(item)
      const resolution = await resolveItem(item, merchant.name)
      const resolvedItem = resolution
        ? {
            ...item,
            standardized_name: resolution.standardized_name || item.standardized_name,
            brand: resolution.brand || item.brand,
            parent_corporation: resolution.parent_corporation || getParentName(item),
            ticker: resolution.ticker || getTicker(item),
            gross_margin_pct: resolution.gross_margin_pct ?? item.gross_margin_pct,
            net_margin_pct: resolution.net_margin_pct ?? item.net_margin_pct,
          }
        : item
      const upstreamParent = await resolveItemEntity(resolvedItem, retailerParent)
      const isUnmappedUpstream = upstreamParent.company_name === UNMAPPED_PARENT
      const candidates = resolution?.candidates ?? []
      const parts = getAttributionParts(
        attributionMode,
        amount,
        retailerParent,
        upstreamParent,
        isUnmappedUpstream,
      )
      const splitApplied = parts.length === 2 &&
        Math.abs(parts[0].amount - parts[1].amount) < 0.000001
      const brand = getBrandDisplay(resolvedItem, false)
      const normalizedBrand = normalizeText(brand)
      uniqueBrands.add(normalizedBrand)
      for (const { entity, amount: attributedSpend } of parts) {
        if (!attributedSpend) continue
        const entityKey = getEntityKey(entity)
        const grossProfit = attributedSpend * toNumber(entity.gross_margin_pct) / 100
        const netProfit = attributedSpend * toNumber(entity.net_margin_pct) / 100

        uniqueConglomerates.add(entityKey)
        estGrossProfitExtracted += grossProfit
        estNetProfitExtracted += netProfit
        monthly.corporateGrossProfit += grossProfit

        if (!conglomerates.has(entityKey)) {
          conglomerates.set(entityKey, {
            key: entityKey,
            company_name: entity.company_name,
            ticker: entity.ticker,
            sector: entity.sector,
            totalSpent: 0,
            sharePct: 0,
            gross_margin_pct: toNumber(entity.gross_margin_pct),
            net_margin_pct: toNumber(entity.net_margin_pct),
            estGrossProfit: 0,
            estNetProfit: 0,
            brands: [],
            itemCount: 0,
          })
        }
        const conglomerate = conglomerates.get(entityKey)
        conglomerate.totalSpent += attributedSpend
        conglomerate.estGrossProfit += grossProfit
        conglomerate.estNetProfit += netProfit
        conglomerate.itemCount += 1
        if (brand && !conglomerate.brands.includes(brand)) conglomerate.brands.push(brand)

        const brandKey = `${normalizedBrand}|${entityKey}`
        if (!brands.has(brandKey)) {
          brands.set(brandKey, {
            key: brandKey,
            brand,
            totalSpent: 0,
            itemCount: 0,
            parent_corporation: entity.company_name,
            ticker: entity.ticker,
          })
        }
        const brandEntry = brands.get(brandKey)
        brandEntry.totalSpent += attributedSpend
        brandEntry.itemCount += 1
      }

      const standardizedName = getItemDescription(resolvedItem).replace(/^\s*\d{3,}\s*/, '')
      const inventoryKey = normalizeText(item.sku || item.barcode || standardizedName)
      if (inventoryKey) {
        if (!itemsInventory.has(inventoryKey)) {
          itemsInventory.set(inventoryKey, {
            key: inventoryKey,
            item_key: normalizeText(
              (item.sku ?? item.barcode ?? item.gtin) ||
              item.standardized_name || item.name || item.description,
            ),
            standardized_name: standardizedName,
            raw_sku: String(item.sku || item.raw_name || item.name || item.description || ''),
            barcode: String(item.barcode ?? item.gtin ?? ''),
            brand: String(resolvedItem.brand ?? ''),
            parent_corporation: String(resolvedItem.parent_corporation ?? ''),
            ticker: getTicker(resolvedItem),
            totalSpend: 0,
            purchaseCount: 0,
            resolvedRetailParent: retailerParent?.company_name ?? null,
            retailGatekeepers: [],
            resolvedUpstreamParent: upstreamParent.company_name,
            candidates,
            source: resolution?.source ?? 'receipt',
            splitApplied,
            isOverride: Boolean(resolution?.isOverride),
          })
        }
        const inventoryEntry = itemsInventory.get(inventoryKey)
        inventoryEntry.totalSpend += amount
        inventoryEntry.purchaseCount += 1
        inventoryEntry.splitApplied ||= splitApplied
        const retailerTicker = retailerParent?.ticker ?? merchant.ticker ?? null
        if ((retailerParent || retailerTicker) && !inventoryEntry.retailGatekeepers.some(
          (entry) => entry.name === merchant.name && entry.ticker === retailerTicker,
        )) {
          inventoryEntry.retailGatekeepers.push({
            name: merchant.name,
            ticker: retailerTicker,
          })
        }
        if (!inventoryEntry.brand && resolvedItem.brand) inventoryEntry.brand = String(resolvedItem.brand)
        if (!inventoryEntry.parent_corporation && resolvedItem.parent_corporation) {
          inventoryEntry.parent_corporation = String(resolvedItem.parent_corporation)
        }
        if (!inventoryEntry.ticker) inventoryEntry.ticker = getTicker(resolvedItem)
        if (resolution?.isOverride) inventoryEntry.source = 'user_override'
        else if (resolution?.source === 'open_food_facts') inventoryEntry.source = 'open_food_facts'
        else if (resolution?.source === 'community' && inventoryEntry.source !== 'user_override' &&
          inventoryEntry.source !== 'open_food_facts') inventoryEntry.source = 'community'
        if (!inventoryEntry.candidates.length && candidates.length) {
          inventoryEntry.candidates = candidates
        }
        inventoryEntry.isOverride ||= Boolean(resolution?.isOverride)
      }

      const normalizedName = normalizeText(standardizedName)
      if (normalizedName && Number.isFinite(Number(item.unit_price))) {
        const upstreamKey = getEntityKey(upstreamParent)
        const inflationKey = `${normalizedName}|${upstreamKey}`
        if (!inflationItems.has(inflationKey)) {
          inflationItems.set(inflationKey, {
            standardized_name: standardizedName,
            pricesByDate: new Map(),
            parent_corporation: upstreamParent.company_name,
            ticker: upstreamParent.ticker,
          })
        }
        const inflationEntry = inflationItems.get(inflationKey)
        const date = String(bill.date).slice(0, 10)
        if (!inflationEntry.pricesByDate.has(date)) {
          inflationEntry.pricesByDate.set(date, [])
        }
        inflationEntry.pricesByDate.get(date).push(toNumber(item.unit_price))
      }
    }
  }

  const rankedConglomerates = formatRanking(conglomerates)
  const knownConglomerates = rankedConglomerates.filter(
    (entry) => entry.company_name !== UNCLASSIFIED_NAME &&
      entry.company_name !== UNMAPPED_PARENT &&
      entry.company_name !== 'Costco private-label supplier (not disclosed)',
  )
  const unclassifiedConglomerates = rankedConglomerates.filter(
    (entry) => entry.company_name === UNCLASSIFIED_NAME,
  )
  const unclassifiedSpend = unclassifiedConglomerates.reduce(
    (sum, entry) => sum + entry.totalSpent,
    0,
  )
  const conglomeratesRanking = [...knownConglomerates, ...unclassifiedConglomerates].map((entry) => ({
    ...entry,
    estGrossProfit: round(entry.estGrossProfit),
    estNetProfit: round(entry.estNetProfit),
    sharePct: netItemSpend
      ? Math.round((entry.totalSpent / netItemSpend) * 1000) / 10
      : 0,
    brands: entry.brands.sort((a, b) => a.localeCompare(b)),
  }))
  const merchantsRanking = formatRanking(merchants).map((entry) => ({
    ...entry,
    sharePct: totalSpent ? round((entry.totalSpent / totalSpent) * 100) : 0,
  }))
  const brandRanking = formatRanking(brands).map((entry) => ({
    ...entry,
    sharePct: subtotalSpent ? round((entry.totalSpent / subtotalSpent) * 100) : 0,
  }))
  const inflationTracker = [...inflationItems.values()]
    .flatMap((entry) => {
      const dates = [...entry.pricesByDate.keys()].sort()
      if (dates.length < 2) return []

      const earliestDate = dates[0]
      const latestDate = dates[dates.length - 1]
      const earliestPrices = entry.pricesByDate.get(earliestDate)
      const latestPrices = entry.pricesByDate.get(latestDate)
      const earliestUnitPrice =
        earliestPrices.reduce((sum, price) => sum + price, 0) / earliestPrices.length
      const latestUnitPrice =
        latestPrices.reduce((sum, price) => sum + price, 0) / latestPrices.length
      const priceChangeAbs = latestUnitPrice - earliestUnitPrice

      return [{
        standardized_name: entry.standardized_name,
        firstDate: earliestDate,
        lastDate: latestDate,
        earliestUnitPrice: round(earliestUnitPrice),
        latestUnitPrice: round(latestUnitPrice),
        priceChangeAbs: round(priceChangeAbs),
        priceChangePct: earliestUnitPrice
          ? round((priceChangeAbs / earliestUnitPrice) * 100)
          : null,
        parent_corporation: entry.parent_corporation,
        ticker: entry.ticker,
      }]
    })
    .sort((a, b) => (b.priceChangePct ?? -Infinity) - (a.priceChangePct ?? -Infinity))
  const timelineData = [...monthlyTotals.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((entry) => {
      const corporateGrossProfit = round(entry.corporateGrossProfit)
      return {
        month: entry.month,
        netProductCost: round(entry.subtotalSpent - corporateGrossProfit),
        corporateGrossProfit,
        tax: round(entry.tax),
      }
    })
  const unmappedSpend = rankedConglomerates
    .filter((entry) => entry.company_name === UNMAPPED_PARENT ||
      entry.company_name === 'Costco private-label supplier (not disclosed)')
    .reduce((sum, entry) => sum + entry.totalSpent, 0)
  const topThreeSharePct = conglomeratesRanking
    .slice(0, 3)
    .reduce((sum, entry) => sum + entry.sharePct, 0)

  return {
    summary: {
      totalSpent: round(totalSpent),
      subtotalSpent: round(subtotalSpent),
      totalTax: round(totalTax),
      taxPct: subtotalSpent ? round((totalTax / subtotalSpent) * 100) : 0,
      estGrossProfitExtracted: round(estGrossProfitExtracted),
      estNetProfitExtracted: round(estNetProfitExtracted),
      billCount: filteredBills.length,
      uniqueBrandsCount: uniqueBrands.size,
      uniqueConglomeratesCount:
        uniqueConglomerates.size -
        (unclassifiedSpend ? 1 : 0) -
        (unmappedSpend ? 1 : 0),
      cr3Pct: Math.round(topThreeSharePct * 10) / 10,
    },
    unclassifiedSpend: round(unclassifiedSpend),
    unmappedSpend: round(unmappedSpend),
    billLevelSavings: round(billLevelSavings),
    itemsInventory: [...itemsInventory.values()]
      .map((item) => ({ ...item, totalSpend: round(item.totalSpend) }))
      .sort((first, second) => second.totalSpend - first.totalSpend),
    conglomeratesRanking,
    merchantsRanking,
    brandRanking,
    inflationTracker,
    timelineData,
  }
}
