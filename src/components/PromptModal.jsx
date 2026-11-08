import { useState } from 'react'
import { Check, Clipboard, Sparkles } from 'lucide-react'
import ModalShell from './ModalShell.jsx'

const SYSTEM_PROMPT = `You are a meticulous forensic receipt and utility-bill analyst. Extract only facts that are visible on the supplied receipt, invoice, or utility bill. Never invent, infer, or silently normalize a value that is not supported by the document. Use ISO dates (YYYY-MM-DD), numeric amounts, and null where a value is absent or unreadable. Preserve the document currency in the currency field. Return valid JSON only, with no Markdown fences or commentary.

Return one bill as a JSON object, or multiple bills as a JSON array, using this exact schema:
{
  "bill_id": "a concise unique document identifier",
  "date": "YYYY-MM-DD",
  "bill_type": "retail | utility | telecom | other",
  "currency": "CAD",
  "merchant": {
    "name": "merchant or utility provider name",
    "ticker": "merchant/operator ticker if publicly listed, otherwise null",
    "channel": "grocery, electric utility, telecom, or other useful category"
  },
  "summary": {
    "subtotal": 0.00,
    "tax": 0.00,
    "total": 0.00
  },
  "items": [
    {
      "name": "description as printed",
      "standardized_name": "consistent product or service name for comparison across receipts",
      "brand": "consumer-facing brand or provider",
      "parent_corporation": "owning parent company; use null if unknown",
      "ticker": "the parent_corporation's stock ticker, not the brand or store ticker; use null if private or unknown",
      "quantity": 1,
      "unit_price": 0.00,
      "total_price": 0.00
    }
  ]
}

Rules:
- Include every purchased line item, recurring utility charge, fee, discount, and tax line that can be represented as an item; do not omit a line because it is small.
- For each product, identify its actual parent corporation separately from the retailer. The item's ticker must belong to that parent corporation. Do not copy the merchant's ticker onto unrelated products.
- Keep standardized_name stable for the same product across receipts. Preserve meaningful size or unit details (for example, "2% Milk 2L").
- Use the printed quantity and unit price. If only a line total is available, set total_price to that amount and set unit_price to null when it cannot be derived.
- Summary subtotal excludes tax where the document distinguishes tax; total must match the printed amount paid. Do not fabricate a tax amount.
- Return no explanations, confidence notes, or extra fields. Output JSON only.`

export default function PromptModal({ onClose }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(SYSTEM_PROMPT)
      setCopied(true)
      setError('')
    } catch (copyError) {
      console.error('Unable to copy the analyst prompt:', copyError)
      setError('Clipboard access was denied. Select and copy the prompt below.')
    }
  }

  return (
    <ModalShell
      title="Your forensic analyst"
      description="Copy the system prompt, then paste it into ChatGPT, Claude, Gemini, or another AI assistant with your receipt images."
      onClose={onClose}
      wide
    >
      <div className="prompt-callout"><Sparkles size={16} /><span>Evidence only. No invented amounts. Parent-company tickers on every item.</span></div>
      <pre className="prompt-preview">{SYSTEM_PROMPT}</pre>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <span className="modal-hint">Your documents stay with the AI service you choose.</span>
        <button className="button button-primary" onClick={copyPrompt}>
          {copied ? <Check size={16} /> : <Clipboard size={16} />}
          {copied ? 'Copied to clipboard' : 'Copy AI Prompt'}
        </button>
      </div>
    </ModalShell>
  )
}
