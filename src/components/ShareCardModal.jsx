import { useRef, useState } from 'react'
import { Download, LoaderCircle, Share2, TrendingUp } from 'lucide-react'
import { toPng } from 'html-to-image'
import ModalShell from './ModalShell.jsx'

const cardCurrency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
})

function amount(value) {
  return cardCurrency.format(Number(value) || 0)
}

export default function ShareCardModal({ analysis, period, biggestHike, onClose }) {
  const cardRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const summary = analysis.summary

  async function downloadCard() {
    if (!cardRef.current) return
    setBusy(true)
    setError('')
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0b1115',
      })
      const link = document.createElement('a')
      link.download = 'who-controls-my-bill.png'
      link.href = dataUrl
      link.click()
    } catch (downloadError) {
      console.error('Unable to generate the summary card:', downloadError)
      setError('The PNG card could not be generated. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Your spending, exposed."
      description="A snapshot of the companies behind your household spending. Download it or share the image."
      onClose={onClose}
      wide
    >
      <div className="share-card-stage">
        <article className="share-card" ref={cardRef}>
          <div className="share-card-topline"><span className="share-card-brand"><span className="share-brand-symbol">↗</span> THE RECEIPT / REPORT</span><span className="share-edition">VOL. 01</span></div>
          <div className="share-card-title"><p>YOUR PERSONAL SPENDING REPORT</p><h3>WHO CONTROLS<br />MY <span>BILL?</span></h3></div>
          <div className="share-card-period"><span>INVESTIGATION PERIOD</span><strong>{period}</strong></div>
          <div className="share-total"><span>TOTAL SPEND</span><strong>{amount(summary.totalSpent)}</strong><small>across {summary.billCount} bills</small></div>
          <div className="share-cr3"><div><span>CR3 OLIGOPOLY CONTROL</span><strong>{summary.cr3Pct}%</strong></div><div className="share-cr3-bar"><i style={{ width: `${Math.min(summary.cr3Pct, 100)}%` }} /></div></div>
          <div className="share-companies">
            <div className="share-section-head"><span>THE TOP 3 PARENTS</span><span>GROSS / NET MARGIN</span></div>
            {analysis.conglomeratesRanking.slice(0, 3).map((company, index) => (
              <div className="share-company" key={company.key}>
                <span className={`share-company-rank rank-color-${index}`}>0{index + 1}</span>
                <div className="share-company-name"><strong>{company.company_name}</strong><span>{company.ticker || 'PRIVATE'}</span></div>
                <div className="share-company-margin"><strong>{company.gross_margin_pct}% / {company.net_margin_pct}%</strong><span>GROSS / NET</span></div>
              </div>
            ))}
          </div>
          <div className="share-bottom-grid">
            <div className="share-profit"><span>CORPORATE GROSS PROFIT</span><strong>{amount(summary.estGrossProfitExtracted)}</strong><small>estimated from your spend</small></div>
            <div className="share-tax"><span>TAX BITE</span><strong>{summary.taxPct}%</strong><small>{amount(summary.totalTax)} in taxes</small></div>
          </div>
          <div className="share-hike"><TrendingUp size={15} /><div><span>#1 BIGGEST PRICE HIKE</span><strong>{biggestHike ? `${biggestHike.standardized_name}  +${biggestHike.priceChangePct}%` : 'Not enough data to compare prices'}</strong></div></div>
          <div className="share-card-footer"><span>FOLLOW THE MONEY.</span><span>ESTIMATES · NOT AUDITED FINANCIALS</span></div>
        </article>
        <div className="share-aside">
          <span className="share-preview-icon"><Share2 size={20} /></span>
          <h3>Make the numbers visible.</h3>
          <p>Your 4:5 report card includes the spending period, oligopoly share, parent-company margins, estimated profit, tax, and biggest tracked price hike.</p>
          <span className="aspect-note">PORTRAIT · 4:5 · PNG</span>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><span className="modal-hint">Company margins and extracted profit are estimates.</span><button className="button button-primary" onClick={downloadCard} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}{busy ? 'Generating PNG…' : 'Download PNG Card'}</button></div>
    </ModalShell>
  )
}
