const FUNDAMENTALS_URL = `${import.meta.env.BASE_URL}tickers-fundamentals.json`
const UNKNOWN_ENTITY = {
  company_name: 'Unknown entity',
  sector: 'Unknown',
  gross_margin_pct: 30,
  net_margin_pct: 8,
}

export const PRIVATE_GIANTS_MAP = {
  mars: {
    company_name: 'Mars, Incorporated',
    sector: 'Food & Pet Care',
    gross_margin_pct: 48,
    net_margin_pct: 14,
    aliases: ['Mars', 'Mars, Inc.', 'Mars Incorporated'],
  },
  cargill: {
    company_name: 'Cargill, Incorporated',
    sector: 'Agriculture & Food',
    gross_margin_pct: 12,
    net_margin_pct: 3,
    aliases: ['Cargill', 'Cargill, Inc.', 'Cargill Incorporated'],
  },
  agropur: {
    company_name: 'Agropur Cooperative',
    sector: 'Dairy',
    gross_margin_pct: 20,
    net_margin_pct: 3,
    aliases: ['Agropur', 'Agropur Cooperative'],
  },
  'gay-lea': {
    company_name: 'Gay Lea Foods Co-operative Limited',
    sector: 'Dairy',
    gross_margin_pct: 25,
    net_margin_pct: 3,
    aliases: ['Gay Lea', 'Gay Lea Foods', 'Gay Lea Foods Co-operative'],
  },
  scotsburn: {
    company_name: 'Scotsburn',
    sector: 'Dairy',
    gross_margin_pct: 25,
    net_margin_pct: 3,
    aliases: ['Scotsburn', 'Scotsburn Dairy'],
  },
  'farmers-dairy': {
    company_name: 'Farmers Dairy',
    sector: 'Dairy',
    gross_margin_pct: 25,
    net_margin_pct: 3,
    aliases: ['Farmers Dairy', 'Farmers Co-operative Dairy'],
  },
  lole: {
    company_name: 'Lolë',
    sector: 'Apparel & Footwear',
    gross_margin_pct: 45,
    net_margin_pct: 5,
    aliases: ['Lolë', 'Lole'],
  },
  'tuff-athletics': {
    company_name: 'Tuff Athletics',
    sector: 'Apparel & Footwear',
    gross_margin_pct: 45,
    net_margin_pct: 5,
    aliases: ['Tuff Athletics', 'Tuff'],
  },
  'sc-johnson': {
    company_name: 'S. C. Johnson & Son, Inc.',
    sector: 'Household & Personal Care',
    gross_margin_pct: 45,
    net_margin_pct: 10,
    aliases: ['SC Johnson', 'S. C. Johnson', 'S.C. Johnson & Son'],
  },
  aldi: {
    company_name: 'Aldi (Aldi Einkauf GmbH & Co. oHG)',
    sector: 'Grocery Retail',
    gross_margin_pct: 20,
    net_margin_pct: 3,
    aliases: ['Aldi', 'Aldi Nord', 'Aldi Sud', 'Aldi Süd'],
  },
  ikea: {
    company_name: 'IKEA (Ingka Group)',
    sector: 'Home Furnishings Retail',
    gross_margin_pct: 35,
    net_margin_pct: 5,
    aliases: ['IKEA', 'Ingka Group', 'Inter IKEA'],
  },
  koch: {
    company_name: 'Koch Industries, Inc.',
    sector: 'Conglomerate',
    gross_margin_pct: 25,
    net_margin_pct: 7,
    aliases: ['Koch Industries', 'Koch Industries, Inc.', 'Koch'],
  },
  'public-utility': {
    company_name: 'Provincial or Municipal Utility',
    sector: 'Public Utilities',
    gross_margin_pct: 35,
    net_margin_pct: 5,
    aliases: [
      'provincial utility',
      'municipal utility',
      'city utility',
      'public utility',
      'hydro utility',
    ],
  },
}

let fundamentalsPromise

function loadFundamentals() {
  if (!fundamentalsPromise) {
    fundamentalsPromise = fetch(FUNDAMENTALS_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load company fundamentals (${response.status})`)
        }
        return response.json().then((fundamentals) => {
          if (!fundamentals || typeof fundamentals !== 'object' || Array.isArray(fundamentals)) {
            throw new TypeError('Company fundamentals must be a JSON object.')
          }
          return fundamentals
        })
      })
      .catch((error) => {
        console.warn('Company fundamentals could not be loaded; continuing with local company estimates.', error)
        return {}
      })
  }
  return fundamentalsPromise
}

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function isGenericName(value) {
  const normalized = normalizeName(value)
  return !normalized || /^(unknown|generic|unbranded|unclassified)(?:\s|$)/.test(normalized) || /^(n a|na)$/.test(normalized)
}

function matchPrivateEntity(rawParentName) {
  const normalizedName = normalizeName(rawParentName)
  if (!normalizedName) return undefined

  return Object.values(PRIVATE_GIANTS_MAP).find(({ aliases }) =>
    aliases.some((alias) => {
      const normalizedAlias = normalizeName(alias)
      return (
        normalizedName === normalizedAlias ||
        ` ${normalizedName} `.includes(` ${normalizedAlias} `)
      )
    }),
  )
}

export async function resolveEntity(ticker, rawParentName, rawBrandName) {
  const fundamentals = await loadFundamentals()
  const normalizedTicker = String(ticker ?? '').trim().toUpperCase()
  const listedEntity = normalizedTicker ? fundamentals[normalizedTicker] : undefined

  if (listedEntity) {
    return { ...listedEntity, ticker: normalizedTicker }
  }

  const privateEntity =
    matchPrivateEntity(rawParentName) ||
    (isGenericName(rawParentName) ? matchPrivateEntity(rawBrandName) : undefined)
  if (privateEntity) {
    const { aliases: _aliases, ...entity } = privateEntity
    return { ...entity, ticker: normalizedTicker || null }
  }

  const preservedName = isGenericName(rawParentName)
    ? String(rawBrandName ?? '').trim()
    : String(rawParentName ?? '').trim()
  return {
    ...UNKNOWN_ENTITY,
    company_name: preservedName || UNKNOWN_ENTITY.company_name,
    ticker: normalizedTicker || null,
  }
}
