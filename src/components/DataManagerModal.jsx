import { useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Database,
  Download,
  FileJson2,
  LoaderCircle,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import demoBills from '../data/demoData.json'
import {
  WhoControlsYourBillDB,
  exportBillsToJson,
  getAllBills,
  importBillsWithDedup,
} from '../db/database.js'
import ModalShell from './ModalShell.jsx'
import PromptModal from './PromptModal.jsx'

function extractBills(value) {
  const bills = Array.isArray(value) ? value : value?.bills
  if (!Array.isArray(bills) || bills.length === 0) {
    throw new TypeError('Expected a non-empty JSON array of bills, or an object containing a bills array.')
  }
  function isISODate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
    const parsedDate = new Date(`${date}T00:00:00Z`)
    return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date
  }
  function isAmount(amount) {
    return amount === null || (typeof amount === 'number' && Number.isFinite(amount))
  }
  for (const [index, bill] of bills.entries()) {
    const position = `Bill ${index + 1}`
    if (!bill || typeof bill !== 'object' || Array.isArray(bill)) {
      throw new TypeError(`${position} must be a JSON object.`)
    }
    const merchantName = typeof bill.merchant === 'string' ? bill.merchant : bill.merchant?.name
    if (!isISODate(bill.date) || typeof merchantName !== 'string' || !merchantName.trim() ||
      !bill.summary || typeof bill.summary !== 'object' || Array.isArray(bill.summary) ||
      !Array.isArray(bill.items)) {
      throw new TypeError(`${position} needs date, merchant, summary, and an items array.`)
    }
    const summaryAmounts = ['subtotal', 'tax', 'total'].filter((key) => Object.hasOwn(bill.summary, key))
    if (!summaryAmounts.length || summaryAmounts.some((key) => !isAmount(bill.summary[key]))) {
      throw new TypeError(`${position} summary must contain numeric subtotal, tax, or total amounts.`)
    }
    for (const [itemIndex, item] of bill.items.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item) ||
        typeof item.standardized_name !== 'string' || !item.standardized_name.trim()) {
        throw new TypeError(`${position}, item ${itemIndex + 1} needs standardized_name.`)
      }
      if (!Object.hasOwn(item, 'parent_corporation') && !Object.hasOwn(item, 'parent')) {
        throw new TypeError(`${position}, item ${itemIndex + 1} needs parent_corporation.`)
      }
      const parent = Object.hasOwn(item, 'parent_corporation')
        ? item.parent_corporation
        : item.parent
      if (parent !== null && typeof parent !== 'string') {
        throw new TypeError(`${position}, item ${itemIndex + 1} parent_corporation must be a name or null.`)
      }
      if (Object.hasOwn(item, 'ticker') && item.ticker !== null && typeof item.ticker !== 'string') {
        throw new TypeError(`${position}, item ${itemIndex + 1} ticker must be a string or null.`)
      }
      for (const key of ['quantity', 'unit_price', 'total_price']) {
        if (Object.hasOwn(item, key) && !isAmount(item[key])) {
          throw new TypeError(`${position}, item ${itemIndex + 1} ${key} must be numeric or null.`)
        }
      }
    }
  }
  return bills
}

function parseBillJson(text) {
  const withoutFence = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  return extractBills(JSON.parse(withoutFence))
}

export default function DataManagerModal({ onClose, onDataChange, onNotify }) {
  const [jsonText, setJsonText] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  const fileInput = useRef(null)

  async function importBills(bills, label) {
    setBusy(label)
    setError('')
    setMessage('')
    try {
      const result = await importBillsWithDedup(bills)
      const response = `Imported ${result.added} bills, skipped ${result.skipped} duplicates.`
      setMessage(response)
      onNotify(response)
      await onDataChange(response)
    } catch (importError) {
      console.error('Unable to import bills:', importError)
      setError(importError instanceof Error ? importError.message : 'Bills could not be imported.')
    } finally {
      setBusy('')
    }
  }

  async function handlePasteImport() {
    try {
      await importBills(parseBillJson(jsonText), 'paste')
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'The pasted JSON is invalid.')
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Choose a .json backup file.')
      return
    }
    setBusy('file')
    setError('')
    try {
      const text = await file.text()
      const bills = parseBillJson(text)
      await importBills(bills, 'file')
    } catch (fileError) {
      console.error('Unable to read or validate the selected backup:', fileError)
      setError(fileError instanceof Error ? fileError.message : 'The selected file could not be imported.')
      setBusy('')
    }
  }

  async function handleDemo() {
    await importBills(demoBills, 'demo')
  }

  async function handleExport() {
    setBusy('export')
    setError('')
    try {
      const savedBills = await getAllBills()
      if (!savedBills.length) {
        setError('There are no locally saved bills to export.')
        return
      }
      await exportBillsToJson()
      setMessage(`Exported ${savedBills.length} locally saved bills.`)
      onNotify('Backup downloaded.')
    } catch (exportError) {
      console.error('Unable to export bill backup:', exportError)
      setError('Backup could not be downloaded. Please try again.')
    } finally {
      setBusy('')
    }
  }

  async function handleClear() {
    if (!window.confirm('Delete all bills saved in this browser? This cannot be undone.')) return
    setBusy('clear')
    setError('')
    try {
      await WhoControlsYourBillDB.bills.clear()
      setMessage('All local bill data has been cleared. Demo data is now shown.')
      onNotify('All local bill data cleared.')
      await onDataChange('All local bill data cleared.')
    } catch (clearError) {
      console.error('Unable to clear local bill data:', clearError)
      setError('Local data could not be cleared. Please try again.')
    } finally {
      setBusy('')
    }
  }

  if (showPrompt) {
    return <PromptModal onClose={() => setShowPrompt(false)} />
  }

  return (
    <ModalShell
      title="Manage your bill data"
      description="Import, back up, or clear the receipts stored privately in this browser."
      onClose={onClose}
      wide
    >
      <div className="data-manager-grid">
        <section className="data-card data-card-paste">
          <div className="data-card-heading"><span className="data-icon"><FileJson2 size={17} /></span><div><h3>Paste AI-generated JSON</h3><p>Accepts a bill array with or without a Markdown code fence.</p></div></div>
          <div className="prompt-help">
            <span>Need AI to extract a receipt first?</span>
            <button type="button" onClick={() => setShowPrompt(true)}><Sparkles size={14} /> Get AI Prompt</button>
          </div>
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            placeholder={'[\n  { "date": "2026-10-12", "merchant": { ... }, "items": [...] }\n]'}
            aria-label="Paste bill JSON"
            spellCheck="false"
          />
          <button className="button button-primary" onClick={handlePasteImport} disabled={!jsonText.trim() || Boolean(busy)}>
            {busy === 'paste' ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} Import pasted bills
          </button>
        </section>

        <div className="data-manager-side">
          <section className="data-card">
            <div className="data-card-heading"><span className="data-icon"><Database size={17} /></span><div><h3>Backup & restore</h3><p>JSON backups are saved and restored locally.</p></div></div>
            <input ref={fileInput} className="visually-hidden" type="file" accept=".json,application/json" onChange={handleFileChange} />
            <button className="button button-muted full-button" onClick={() => fileInput.current?.click()} disabled={Boolean(busy)}>
              {busy === 'file' ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} Upload JSON backup
            </button>
            <button className="button button-muted full-button" onClick={handleExport} disabled={Boolean(busy)}>
              {busy === 'export' ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />} Export Backup (.json)
            </button>
          </section>
          <section className="data-card data-card-demo">
            <div className="data-card-heading"><span className="data-icon"><Check size={17} /></span><div><h3>Explore the dashboard</h3><p>Load the sample grocery and utility bills.</p></div></div>
            <button className="button button-muted full-button" onClick={handleDemo} disabled={Boolean(busy)}>
              {busy === 'demo' ? <LoaderCircle className="spin" size={15} /> : <Database size={15} />} Load Demo Data
            </button>
          </section>
          <button className="clear-data-button" onClick={handleClear} disabled={Boolean(busy)}>
            {busy === 'clear' ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />} Clear All Local Data
          </button>
        </div>
      </div>
      <p className="privacy-note"><Database size={13} /> Bills stay in this browser's IndexedDB unless you export them.</p>
      {message && <p className="form-success" role="status"><Check size={15} />{message}</p>}
      {error && <p className="form-error" role="alert"><AlertTriangle size={15} />{error}</p>}
      <div className="modal-actions"><span className="modal-hint">Imports are deduplicated against bills already saved here.</span><button className="button button-muted" onClick={onClose}>Done</button></div>
    </ModalShell>
  )
}
