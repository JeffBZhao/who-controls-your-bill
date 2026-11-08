import { BookOpenCheck } from 'lucide-react'
import ModalShell from './ModalShell.jsx'

export default function MethodologyModal({ onClose }) {
  return (
    <ModalShell
      title="Methodology & Legal Disclaimer"
      description="How this consumer spending analysis is estimated, and what it does not claim."
      onClose={onClose}
      wide
    >
      <div className="methodology-content">
        <div className="prompt-callout"><BookOpenCheck size={16} /><span>Estimates for informational purposes only; not audited company results or investment advice.</span></div>
        <section>
          <h3>Value-chain margin estimation</h3>
          <p>Receipt line-item spend is matched against local community SKU mappings and, when available, user-entered supplier details. Reported company-wide gross and net margin percentages are applied to the attributed spend as an illustrative estimate. These consolidated margins are not product-specific margins and do not establish how much profit a company earned on an individual purchase.</p>
          <p>The default value-chain view allocates spend between a retail gatekeeper and an upstream producer using the retailer margin estimate. The 50/50 view assigns equal spend to each side, while upstream-only and retail-only views show the full spend attributed to that side. Unmapped and incomplete receipt data can affect these estimates.</p>
        </section>
        <section>
          <h3>Client-side privacy</h3>
          <p>Imported bills, item overrides, and cached lookups are stored in this browser using IndexedDB. Receipt data is not uploaded to this app's server. An explicit Open Food Facts search sends the entered barcode or product name to that service; the optional AI prompt is copied to your clipboard and only shared if you paste it into an AI service.</p>
        </section>
        <section>
          <h3>Trademarks and tickers</h3>
          <p>Company names, brand names, trademarks, and stock tickers are used solely to identify referenced products and entities (nominative fair use). Their appearance does not imply affiliation, endorsement, sponsorship, or access to non-public company information. Tickers are identifiers, not recommendations.</p>
        </section>
        <p className="modal-hint">Please verify supplier identities and financial figures against primary sources before relying on them.</p>
      </div>
    </ModalShell>
  )
}
