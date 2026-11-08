import Dexie from 'dexie'

export const WhoControlsYourBillDB = new Dexie('WhoControlsYourBillDB')

WhoControlsYourBillDB.version(1).stores({
  bills: '&bill_hash, date, bill_type',
})

WhoControlsYourBillDB.version(2).stores({
  bills: '&bill_hash, date, bill_type',
  user_item_overrides: '&item_key, standardized_name, brand, parent_corporation, ticker, updated_at',
  off_cache: '&query_key, result, fetched_at',
})

if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch((error) => {
    console.error('Unable to request persistent browser storage:', error)
  })
}

function normalizeMerchantName(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en')
}

function normalizeDate(date) {
  if (date instanceof Date) return date.toISOString()
  return String(date ?? '').trim()
}

function normalizeTotal(total) {
  if (total === null || total === undefined || total === '') return ''
  const numericTotal = Number(total)
  return Number.isFinite(numericTotal) ? String(numericTotal) : String(total).trim()
}

export async function generateBillHash(bill) {
  const canonicalBill = JSON.stringify([
    normalizeDate(bill?.date),
    normalizeMerchantName(bill?.merchant?.name),
    normalizeTotal(bill?.summary?.total),
    Array.isArray(bill?.items) ? bill.items.length : 0,
  ])
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalBill),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function importBillsWithDedup(billsArray) {
  if (!Array.isArray(billsArray)) {
    throw new TypeError('billsArray must be an array')
  }

  const billsWithHashes = await Promise.all(
    billsArray.map(async (bill) => ({
      ...bill,
      bill_hash: await generateBillHash(bill),
    })),
  )
  const uniqueBills = [
    ...new Map(billsWithHashes.map((bill) => [bill.bill_hash, bill])).values(),
  ]

  return WhoControlsYourBillDB.transaction('rw', WhoControlsYourBillDB.bills, async () => {
    const existingBills = await WhoControlsYourBillDB.bills.bulkGet(
      uniqueBills.map((bill) => bill.bill_hash),
    )
    const existingHashes = new Set(
      existingBills.filter(Boolean).map((bill) => bill.bill_hash),
    )
    const newBills = uniqueBills.filter((bill) => !existingHashes.has(bill.bill_hash))

    if (newBills.length > 0) {
      await WhoControlsYourBillDB.bills.bulkAdd(newBills)
    }

    return {
      added: newBills.length,
      skipped: billsArray.length - newBills.length,
      total: billsArray.length,
    }
  })
}

export function getAllBills() {
  return WhoControlsYourBillDB.bills.toArray().catch(async (error) => {
    if (error?.name !== 'VersionError') throw error

    console.warn('The local database was created by a newer app version; reading saved bills without upgrading it.')
    return readBillsWithoutUpgrade()
  })
}

function readBillsWithoutUpgrade() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WhoControlsYourBillDB')
    request.onerror = () => reject(request.error ?? new Error('Unable to open the existing bill database.'))
    request.onsuccess = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('bills')) {
        database.close()
        resolve([])
        return
      }

      const transaction = database.transaction('bills', 'readonly')
      const billsRequest = transaction.objectStore('bills').getAll()
      billsRequest.onsuccess = () => resolve(billsRequest.result)
      billsRequest.onerror = () => reject(billsRequest.error ?? new Error('Unable to read saved bills.'))
      transaction.oncomplete = () => database.close()
      transaction.onerror = () => {
        database.close()
        reject(transaction.error ?? new Error('Unable to read saved bills.'))
      }
    }
  })
}

export async function exportBillsToJson() {
  const bills = await getAllBills()
  const json = JSON.stringify(bills, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `who-controls-your-bill-backup-${date}.json`
  link.click()
  URL.revokeObjectURL(url)
}
