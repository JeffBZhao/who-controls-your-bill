import { useState } from 'react'
import { Check, Clipboard, LoaderCircle, Search } from 'lucide-react'
import { lookupOpenFoodFacts, saveUserItemOverride } from '../utils/openFoodFactsService.js'
import ModalShell from './ModalShell.jsx'

function candidateLabel(candidate) {
  return `${candidate.brand || 'Unbranded'} · ${candidate.parent_corporation || 'Unknown parent'}`
}

export default function ItemInspectorModal({ item, onClose, onSaved, onNotify }) {
  const [brand, setBrand] = useState(item.brand || '')
  const [parent, setParent] = useState(item.parent_corporation || item.resolvedUpstreamParent || '')
  const [ticker, setTicker] = useState(item.ticker || '')
  const [standardizedName, setStandardizedName] = useState(item.standardized_name || '')
  const [query, setQuery] = useState(item.barcode || item.raw_sku || item.standardized_name)
  const [foundProduct, setFoundProduct] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  async function saveOverride(values = { brand, parent_corporation: parent, ticker, standardized_name: standardizedName }) {
    setBusy('save')
    setError('')
    try {
      await saveUserItemOverride(item.item_key, values)
      onSaved()
      onNotify(`Saved supplier details for ${values.standardized_name || item.standardized_name}.`)
    } catch (saveError) {
      console.error('Unable to save item supplier override:', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Supplier details could not be saved.')
    } finally {
      setBusy('')
    }
  }

  async function applyCandidate(candidate) {
    setBrand(candidate.brand || '')
    setParent(candidate.parent_corporation || '')
    setTicker(candidate.ticker || '')
    await saveOverride({
      standardized_name: item.standardized_name,
      brand: candidate.brand || '',
      parent_corporation: candidate.parent_corporation || '',
      ticker: candidate.ticker || '',
    })
  }

  async function searchOpenFoodFacts(event) {
    event.preventDefault()
    setBusy('search')
    setError('')
    setFoundProduct(null)
    try {
      const product = await lookupOpenFoodFacts(query)
      if (!product) {
        setError('No product with a usable brand was found. Try a barcode or a more specific product name.')
      } else {
        setFoundProduct(product)
      }
    } catch (lookupError) {
      console.error('Open Food Facts lookup failed:', lookupError)
      setError(lookupError instanceof Error ? lookupError.message : 'Open Food Facts could not be reached.')
    } finally {
      setBusy('')
    }
  }

  async function copyText(kind, text) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setError('')
    } catch (copyError) {
      console.error('Unable to copy item inspector text:', copyError)
      setError('Clipboard access was denied. Select and copy the generated text manually.')
    }
  }

  const packagingPrompt = `Identify the manufacturer and parent corporation for this product using only visible physical package evidence. Inspect the brand name, "distributed/manufactured by" text, plant or establishment number, and country-of-origin markings. Do not guess if the evidence is inconclusive; report the exact label evidence and uncertainty.

Product: ${item.standardized_name}
Raw receipt SKU/name: ${item.raw_sku || 'Not recorded'}
Barcode: ${item.barcode || 'Not recorded'}

Return: brand, legal manufacturer, parent corporation, ticker (if publicly listed), package evidence, and confidence.`
  const dictionarySnippet = JSON.stringify({
    match_keys: [item.raw_sku, item.barcode, item.standardized_name].filter(Boolean),
    merchant_hint: item.retailGatekeepers?.[0]?.name || 'ANY',
    standardized_name: standardizedName || item.standardized_name,
    candidates: [{
      brand,
      parent_corporation: parent,
      ticker: ticker || null,
      share_pct: 100,
    }],
  }, null, 2)

  return (
    <ModalShell
      title="Item-level supply chain inspector"
      description="Review the receipt match, compare community candidates, or add an evidence-based supplier override."
      onClose={onClose}
      wide
    >
      <div className="inspector-summary">
        <div>
          <span className="eyebrow">RANKED PURCHASE</span>
          <h3>{item.standardized_name}</h3>
          <p>Raw SKU/name: {item.raw_sku || 'Not recorded'} · {item.purchaseCount} purchases · {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(item.totalSpend)}</p>
        </div>
        {item.retailGatekeepers?.map((gatekeeper) => (
          <span className="ticker" key={`${gatekeeper.name}-${gatekeeper.ticker}`}>{gatekeeper.ticker || gatekeeper.name}</span>
        ))}
      </div>

      {item.candidates?.length > 0 && (
        <section className="inspector-section">
          <h3>Community supplier candidates</h3>
          <p className="modal-hint">Choose a candidate to save it as your local override and re-run the analysis.</p>
          <div className="candidate-list">
            {item.candidates.map((candidate, index) => (
              <button
                className="candidate-option"
                key={`${candidate.parent_corporation}-${candidate.brand}-${index}`}
                onClick={() => applyCandidate(candidate)}
                disabled={Boolean(busy)}
              >
                <span><strong>{candidateLabel(candidate)}</strong><small>{candidate.ticker || 'Private / no ticker'}</small></span>
                <b>{Number(candidate.share_pct) || 0}% community share</b>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="inspector-section">
        <h3>Search Open Food Facts</h3>
        <form className="inspector-search" onSubmit={searchOpenFoodFacts}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Barcode or product name" placeholder="Barcode or product name" />
          <button className="button button-muted" type="submit" disabled={!query.trim() || Boolean(busy)}>
            {busy === 'search' ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />} Search
          </button>
        </form>
        {foundProduct && (
          <div className="off-result">
            <div><strong>{foundProduct.standardized_name}</strong><span>{foundProduct.brand} · {foundProduct.parent_corporation}</span></div>
            <button
              className="button button-primary"
              onClick={() => saveOverride({
                standardized_name: foundProduct.standardized_name || standardizedName,
                brand: foundProduct.brand || '',
                parent_corporation: foundProduct.parent_corporation || '',
                ticker: foundProduct.ticker || '',
              })}
              disabled={Boolean(busy)}
            >
              Apply product
            </button>
          </div>
        )}
      </section>

      <section className="inspector-section">
        <h3>Supplier details</h3>
        <div className="inspector-fields">
          <label>Standardized name<input value={standardizedName} onChange={(event) => setStandardizedName(event.target.value)} /></label>
          <label>Brand<input value={brand} onChange={(event) => setBrand(event.target.value)} /></label>
          <label>Parent corporation<input value={parent} onChange={(event) => setParent(event.target.value)} /></label>
          <label>Stock ticker<input value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder="Optional" /></label>
        </div>
        <button className="button button-primary inspector-save" onClick={() => saveOverride()} disabled={Boolean(busy)}>
          {busy === 'save' ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save supplier override
        </button>
      </section>

      <section className="inspector-tools">
        <button className="button button-muted" onClick={() => copyText('prompt', packagingPrompt)}>
          <Clipboard size={14} /> {copied === 'prompt' ? 'Packaging prompt copied' : 'Copy Packaging AI Prompt'}
        </button>
        <button className="button button-muted" onClick={() => copyText('json', dictionarySnippet)}>
          <Clipboard size={14} /> {copied === 'json' ? 'Dictionary JSON copied' : 'Copy JSON for GitHub Dictionary'}
        </button>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
    </ModalShell>
  )
}
