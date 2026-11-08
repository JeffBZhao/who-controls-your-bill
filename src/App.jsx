import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Database,
  Download,
  FileJson2,
  Landmark,
  Menu,
  ReceiptText,
  Share2,
  Sparkles,
  Tags,
  TrendingUp,
  TriangleAlert,
  Wallet,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import demoBills from './data/demoData.json'
import {
  getAllBills,
} from './db/database.js'
import { analyzeBills } from './utils/analyticsEngine.js'
import DataManagerModal from './components/DataManagerModal.jsx'
import ItemInspectorModal from './components/ItemInspectorModal.jsx'
import MethodologyModal from './components/MethodologyModal.jsx'
import PromptModal from './components/PromptModal.jsx'
import ShareCardModal from './components/ShareCardModal.jsx'
import './App.css'

const COLORS = ['#b2f36b', '#73d2de', '#f4a261', '#c4b5fd', '#fb7185', '#facc15']
const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 2,
})
function getDateFilter(range, customStart, customEnd) {
  const today = new Date()
  const isoToday = today.toISOString().slice(0, 10)
  if (range === 'this-month') {
    return { startDate: `${isoToday.slice(0, 7)}-01`, endDate: isoToday }
  }
  if (range === 'last-3') {
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1)
    return { startDate: start.toISOString().slice(0, 10), endDate: isoToday }
  }
  if (range === 'custom') {
    return { startDate: customStart || undefined, endDate: customEnd || undefined }
  }
  return undefined
}

function dateLabel(range, customStart, customEnd) {
  if (range === 'this-month') return 'This month'
  if (range === 'last-3') return 'Last 3 months'
  if (range === 'custom') {
    if (!customStart && !customEnd) return 'Custom date range'
    return `${customStart || 'Beginning'} — ${customEnd || 'Today'}`
  }
  return 'All time'
}

function formatCurrency(value) {
  return currency.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function Ticker({ children, muted = false }) {
  return (
    <span className={`ticker ${muted ? 'ticker-muted' : ''}`}>
      {children || 'PRIVATE'}
    </span>
  )
}

function Panel({ children, className = '', ...props }) {
  return (
    <section className={`panel ${className}`} {...props}>
      {children}
    </section>
  )
}

function PanelHeading({ eyebrow, title, action }) {
  return (
    <div className="panel-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

function KpiCard({ label, value, detail, icon: Icon, tone = 'lime', secondary }) {
  return (
    <Panel className="kpi-card">
      <div className="kpi-top">
        <span className={`kpi-icon kpi-${tone}`}><Icon size={17} /></span>
        <span className="kpi-label">{label}</span>
        {secondary && <span className="kpi-secondary">{secondary}</span>}
      </div>
      <p className="kpi-value">{value}</p>
      <p className="kpi-detail">{detail}</p>
    </Panel>
  )
}

function EmptyState({ children = 'Nothing to show for this period yet.' }) {
  return <div className="empty-state"><Database size={18} /><span>{children}</span></div>
}

function App() {
  const [bills, setBills] = useState([])
  const [isDemo, setIsDemo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [range, setRange] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeModal, setActiveModal] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [breakdown, setBreakdown] = useState('brands')
  const [followMoneyView, setFollowMoneyView] = useState('controllers')
  const [attributionMode, setAttributionMode] = useState('value_chain')
  const [analysisRevision, setAnalysisRevision] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const refreshBills = useCallback(async () => {
    try {
      const savedBills = await getAllBills()
      if (savedBills.length) {
        setBills(savedBills)
        setIsDemo(false)
      } else {
        setBills(demoBills)
        setIsDemo(true)
      }
      setError('')
    } catch (loadError) {
      console.error('Unable to load bills from local storage:', loadError)
      setError('Your local bill data could not be loaded. Please try reloading the page.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadInitialBills() {
      try {
        const savedBills = await getAllBills()
        if (cancelled) return
        if (savedBills.length) {
          setBills(savedBills)
          setIsDemo(false)
        } else {
          setBills(demoBills)
          setIsDemo(true)
        }
        setError('')
      } catch (loadError) {
        console.error('Unable to load bills from local storage:', loadError)
        if (!cancelled) setError('Your local bill data could not be loaded. Please try reloading the page.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadInitialBills()
    return () => { cancelled = true }
  }, [])

  const dateFilter = useMemo(
    () => getDateFilter(range, customStart, customEnd),
    [range, customStart, customEnd],
  )
  const period = dateLabel(range, customStart, customEnd)

  useEffect(() => {
    let cancelled = false
    async function updateAnalysis() {
      try {
        const result = await analyzeBills(bills, dateFilter, attributionMode)
        if (!cancelled) {
          setAnalysis(result)
          setError('')
        }
      } catch (analysisError) {
        console.error('Unable to analyze bill data:', analysisError)
        if (!cancelled) setError('Company data could not be loaded. Check your connection and try again.')
      }
    }
    if (bills.length) updateAnalysis()
    return () => { cancelled = true }
  }, [bills, dateFilter, attributionMode, analysisRevision])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const summary = analysis?.summary
  const handleDataChange = useCallback(async (message) => {
    setNotice(message)
    setIsLoading(true)
    await refreshBills()
  }, [refreshBills])

  const totalOutflow = summary?.totalSpent ?? 0
  const grossRate = summary?.subtotalSpent
    ? (summary.estGrossProfitExtracted / summary.subtotalSpent) * 100
    : 0
  const netRate = summary?.subtotalSpent
    ? (summary.estNetProfitExtracted / summary.subtotalSpent) * 100
    : 0
  const topHike = analysis?.inflationTracker[0]
  const hasData = Boolean(summary?.billCount)
  const merchantCount = analysis?.merchantsRanking.length ?? 0
  const brandsCount = summary?.uniqueBrandsCount ?? 0
  const knownConglomerates = analysis?.conglomeratesRanking.filter(
    (company) => company.company_name !== 'Unknown / Unclassified' &&
      company.company_name !== 'Independent / Unmapped Agribusiness' &&
      company.company_name !== 'Costco private-label supplier (not disclosed)',
  ) ?? []
  const unclassifiedSpend = analysis?.unclassifiedSpend ?? 0
  const unmappedSpend = analysis?.unmappedSpend ?? 0

  const tooltipStyle = {
    backgroundColor: '#111a22',
    border: '1px solid #29363e',
    borderRadius: '12px',
    color: '#edf2ee',
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand-lockup" href="#" aria-label="Who Controls Your Bill home">
          <span className="brand-mark"><BarChart3 size={20} /></span>
          <span className="brand-type">WHO CONTROLS <span>YOUR BILL?</span></span>
        </a>
        <div className="header-right">
          <div className="period-picker">
            <CalendarDays size={15} />
            <select
              aria-label="Date range"
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              <option value="all">All Time</option>
              <option value="this-month">This Month</option>
              <option value="last-3">Last 3 Months</option>
              <option value="custom">Custom Date Range</option>
            </select>
            <ChevronDown size={13} className="select-chevron" />
          </div>
          <button className="mobile-menu-button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <nav className={`header-actions ${mobileMenuOpen ? 'menu-open' : ''}`}>
            <button className="button button-muted" onClick={() => { setActiveModal('methodology'); setMobileMenuOpen(false) }}>
              <BriefcaseBusiness size={15} /><span>Methodology</span>
            </button>
            <button className="button button-muted" onClick={() => { setActiveModal('prompt'); setMobileMenuOpen(false) }}>
              <Sparkles size={15} /><span>1. Get AI Prompt</span>
            </button>
            <button className="button button-muted" onClick={() => { setActiveModal('data'); setMobileMenuOpen(false) }}>
              <FileJson2 size={15} /><span>2. Import / Backup JSON</span>
            </button>
            <button className="button button-primary" onClick={() => { setActiveModal('share'); setMobileMenuOpen(false) }} disabled={!hasData}>
              <Share2 size={15} /><span>Share Summary Card</span>
            </button>
          </nav>
        </div>
      </header>

      {range === 'custom' && (
        <div className="custom-date-row">
          <label>From <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
          <label>To <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
        </div>
      )}

      <div className="dashboard-wrap">
        {isDemo && (
          <div className="demo-banner">
            <Sparkles size={15} />
            <span><strong>Viewing Demo Data</strong> — Import Your Own Bills to Analyze</span>
            <button onClick={() => setActiveModal('data')}>Import bills <ArrowUpRight size={14} /></button>
          </div>
        )}
        {error && <div className="error-banner" role="alert"><TriangleAlert size={16} />{error}</div>}

        <section className="intro-row">
          <div>
            <p className="eyebrow intro-eyebrow"><span className="live-dot" /> HOUSEHOLD SPENDING INTELLIGENCE <span className="eyebrow-divider">/</span> {period.toUpperCase()}</p>
            <h1>The illusion of <span>choice.</span></h1>
            <p className="intro-copy">A closer look at who really profits from your everyday spending.</p>
          </div>
          <div className="intro-mark"><span>INDEPENDENT<br />CONSUMER<br />INTELLIGENCE</span><TrendingUp size={21} /></div>
        </section>

        <section className="thesis-banner">
          <span className="thesis-icon"><BriefcaseBusiness size={19} /></span>
          <div className="thesis-copy">
            <p className="eyebrow">THE ILLUSION OF CHOICE</p>
            {isLoading ? <p>Loading your spending picture…</p> : hasData ? (
              <p>You bought <strong>{brandsCount} brands</strong> across <strong>{merchantCount} merchants</strong>, but <strong className="lime-text">{summary.cr3Pct}%</strong> of your money went to the top 3 conglomerates.</p>
            ) : <p>No bills found for this period. Try another date range or import more bills.</p>}
          </div>
          <span className="thesis-index">01 / 04</span>
        </section>

        <section className="kpi-grid" aria-label="Spending summary">
          <KpiCard label="TOTAL OUTFLOW" value={formatCurrency(totalOutflow)} detail={`${summary?.billCount ?? 0} bills analyzed`} icon={Wallet} tone="lime" />
          <KpiCard label="EST. CONSOLIDATED GROSS MARGIN CAPTURED" value={formatCurrency(summary?.estGrossProfitExtracted)} detail={`${grossRate.toFixed(1)}% gross · Net ${formatCurrency(summary?.estNetProfitExtracted)} (${netRate.toFixed(1)}%)`} icon={CircleDollarSign} tone="blue" />
          <KpiCard label="GOVERNMENT TAX BITE" value={formatCurrency(summary?.totalTax)} detail={`${(summary?.taxPct ?? 0).toFixed(1)}% of subtotal`} icon={Landmark} tone="amber" />
          <KpiCard label="TOP-3 WALLET CONCENTRATION (CR3)" value={`${(summary?.cr3Pct ?? 0).toFixed(1)}%`} detail="Top three parent entities by spend" icon={BarChart3} tone="pink" />
        </section>

        <div className="content-grid">
          <Panel className="leaderboard-panel">
            <PanelHeading
              eyebrow="FOLLOW THE MONEY"
              title={followMoneyView === 'controllers'
                ? 'Ultimate Supply & Pricing Controller'
                : 'Retail Channel Gatekeepers (Merchants)'}
              action={(
                <div className="segmented-control" role="tablist" aria-label="Follow the money view">
                  <button
                    className={followMoneyView === 'controllers' ? 'selected' : ''}
                    onClick={() => setFollowMoneyView('controllers')}
                    role="tab"
                    aria-selected={followMoneyView === 'controllers'}
                  >
                    <BriefcaseBusiness size={13} /> Controllers
                  </button>
                  <button
                    className={followMoneyView === 'merchants' ? 'selected' : ''}
                    onClick={() => setFollowMoneyView('merchants')}
                    role="tab"
                    aria-selected={followMoneyView === 'merchants'}
                  >
                    <ReceiptText size={13} /> Merchants
                  </button>
                </div>
              )}
            />
            <div className="attribution-picker" role="group" aria-label="Spend attribution mode">
              <span>ATTRIBUTION</span>
              {[
                ['value_chain', 'Value-Chain Split (Retailer + Producer)'],
                ['split_50_50', '50/50 Fresh Split'],
                ['upstream_only', 'Upstream Brands Only'],
                ['retailer_only', 'Retail Gatekeepers Only'],
              ].map(([mode, label]) => (
                <button
                  className={attributionMode === mode ? 'selected' : ''}
                  key={mode}
                  onClick={() => setAttributionMode(mode)}
                  aria-pressed={attributionMode === mode}
                >
                  {label}
                </button>
              ))}
            </div>
            {followMoneyView === 'controllers' ? (
              knownConglomerates.length ? (
                <div className="leaderboard">
                  {knownConglomerates.slice(0, 7).map((company, index) => (
                  <div className="leader-row" key={company.key}>
                    <span className="rank">{String(index + 1).padStart(2, '0')}</span>
                    <div className="company-info">
                      <div className="company-name-row"><strong>{company.company_name}</strong><Ticker>{company.ticker}</Ticker></div>
                      <span className="company-sector">{company.sector}</span>
                    </div>
                    <div className="share-column">
                      <div className="share-meta"><span>SHARE OF WALLET</span><b>{company.sharePct.toFixed(1)}%</b></div>
                      <div className="progress-track"><span style={{ width: `${Math.min(company.sharePct, 100)}%`, background: COLORS[index % COLORS.length] }} /></div>
                    </div>
                    <div className="company-spend"><strong>{formatCurrency(company.totalSpent)}</strong><span>Gross {company.gross_margin_pct}% · Net {company.net_margin_pct}%</span></div>
                    <div className="company-profit"><span>EST. GROSS PROFIT</span><strong>{formatCurrency(company.estGrossProfit)}</strong></div>
                  </div>
                  ))}
                </div>
              ) : <EmptyState />
            ) : (
              analysis?.merchantsRanking.length ? (
                <div className="leaderboard">
                  {analysis.merchantsRanking.slice(0, 7).map((merchant, index) => (
                    <div className="leader-row" key={merchant.key}>
                      <span className="rank">{String(index + 1).padStart(2, '0')}</span>
                      <div className="company-info">
                        <div className="company-name-row"><strong>{merchant.name}</strong><Ticker muted>{merchant.ticker || `#${index + 1}`}</Ticker></div>
                        <span className="company-sector">{merchant.channel}</span>
                      </div>
                      <div className="share-column">
                        <div className="share-meta"><span>SHARE OF WALLET</span><b>{merchant.sharePct.toFixed(1)}%</b></div>
                        <div className="progress-track"><span style={{ width: `${Math.min(merchant.sharePct, 100)}%`, background: COLORS[index % COLORS.length] }} /></div>
                      </div>
                      <div className="company-spend"><strong>{formatCurrency(merchant.totalSpent)}</strong><span>{merchant.billCount} {merchant.billCount === 1 ? 'bill' : 'bills'}</span></div>
                      <div className="company-profit"><span>CHANNEL</span><strong>{merchant.channel}</strong></div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState />
            )}
            {followMoneyView === 'controllers' && unclassifiedSpend > 0 && (
              <div className="panel-footnote">
                <span>Unclassified spend · excluded from CR3 and ranking</span>
                <span>{formatCurrency(unclassifiedSpend)}</span>
              </div>
            )}
            {followMoneyView === 'controllers' && unmappedSpend > 0 && (
              <div className="panel-footnote">
                <span>Independent / unmapped supplier spend · excluded from leaderboard and CR3</span>
                <span>{formatCurrency(unmappedSpend)}</span>
              </div>
            )}
            <div className="panel-footnote">
              <span><span className="footnote-dot" />{followMoneyView === 'controllers'
                ? 'Unbranded fresh goods are split between retailers and independent supplier estimates.'
                : 'Merchant totals show the retail channels capturing your wallet.'}</span>
              <span>{followMoneyView === 'controllers' ? 'ESTIMATES · NOT AUDITED FINANCIALS' : 'RECEIPT TOTALS'}</span>
            </div>
          </Panel>

          <Panel className="money-panel">
            <PanelHeading eyebrow="EVERY DOLLAR, ACCOUNTED FOR" title="Where Your Money Really Goes" />
            {analysis?.timelineData.length ? (
              <>
                <div className="chart-legend">
                  <span><i className="legend-cost" />Production cost</span>
                  <span><i className="legend-profit" />Corp. gross profit</span>
                  <span><i className="legend-tax" />Taxes</span>
                </div>
                <div className="money-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.timelineData} margin={{ top: 8, right: 2, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#26333a" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="month" tickFormatter={(value) => value.slice(2)} axisLine={false} tickLine={false} tick={{ fill: '#74848b', fontSize: 10 }} />
                      <YAxis tickFormatter={(value) => `$${value}`} axisLine={false} tickLine={false} tick={{ fill: '#74848b', fontSize: 10 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatCurrency(value), name]} labelFormatter={(value) => `Month: ${value}`} />
                      <Bar dataKey="netProductCost" name="Production cost" stackId="spend" fill="#43565a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="corporateGrossProfit" name="Corporate gross profit" stackId="spend" fill="#b2f36b" />
                      <Bar dataKey="tax" name="Taxes" stackId="spend" fill="#f4a261" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="money-total"><span>PERIOD TOTAL</span><strong>{formatCurrency(totalOutflow)}</strong></div>
              </>
            ) : <EmptyState />}
          </Panel>
        </div>

        <Panel className="inventory-panel">
          <PanelHeading eyebrow="ITEM-LEVEL SUPPLY CHAIN" title="Item-Level Supply Chain Inspector (Ranked by Spend)" />
          {analysis?.itemsInventory.length ? (
            <div className="table-scroll">
              <table className="inventory-table">
                <thead><tr><th>RANK</th><th>STANDARDIZED NAME / RAW SKU</th><th>PURCHASE COUNT</th><th>TOTAL SPEND</th><th>RETAIL GATEKEEPER</th><th>UPSTREAM PRODUCER SOURCE</th></tr></thead>
                <tbody>
                  {analysis.itemsInventory.map((item, index) => {
                    const sourceLabel = item.splitApplied
                      ? '50/50 Split'
                      : ({
                          user_override: 'User Override',
                          community: 'GitHub Community',
                          open_food_facts: 'Open Food Facts',
                          receipt: 'Receipt Data',
                        }[item.source] || 'Receipt Data')
                    return (
                      <tr key={item.key}>
                        <td><span className="inventory-rank">{String(index + 1).padStart(2, '0')}</span></td>
                        <td>
                          <button className="inventory-item-button" onClick={() => setSelectedItem(item)}>
                            <strong>{item.standardized_name}</strong>
                            <small>{item.raw_sku || 'No raw SKU recorded'}</small>
                          </button>
                        </td>
                        <td>{item.purchaseCount}</td>
                        <td className="inventory-spend">{formatCurrency(item.totalSpend)}</td>
                        <td><div className="inventory-badges">
                          {item.retailGatekeepers?.length
                            ? item.retailGatekeepers.map((gatekeeper) => <span className="ticker" key={`${item.key}-${gatekeeper.name}`}>{gatekeeper.ticker || gatekeeper.name}</span>)
                            : <span className="inventory-muted">Not identified</span>}
                        </div></td>
                        <td><span className={`source-badge source-${item.source}`}>{sourceLabel}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState>No purchased items to inspect for this period.</EmptyState>}
          {analysis?.billLevelSavings > 0 && (
            <div className="panel-footnote">
              <span>Bill-level savings · discounts not matched to a specific item</span>
              <span>{formatCurrency(analysis.billLevelSavings)}</span>
            </div>
          )}
          <div className="panel-footnote"><span>Select an item to inspect supplier candidates, search product data, or save a local override.</span><span>RANKED BY CUMULATIVE SPEND</span></div>
        </Panel>

        <Panel className="hikes-panel">
          <PanelHeading eyebrow="THE COST OF THE SAME THING" title="Unit Price Variance Tracker" action={<span className="sort-label"><TrendingUp size={13} /> HIGHEST % INCREASE</span>} />
          {analysis?.inflationTracker.length ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>ITEM</th><th>PARENT CONGLOMERATE</th><th>GROSS MARGIN</th><th>EARLIER PRICE</th><th>LATEST PRICE</th><th>CHANGE</th><th>UNIT CHANGE</th></tr></thead>
                <tbody>{analysis.inflationTracker.slice(0, 6).map((item) => {
                  const company = analysis.conglomeratesRanking.find((entry) =>
                    (item.ticker && entry.ticker === item.ticker) || entry.company_name === item.parent_corporation,
                  )
                  return (
                    <tr key={`${item.standardized_name}-${item.firstDate}`}>
                      <td className="item-cell"><span className="item-indicator"><TrendingUp size={14} /></span><strong>{item.standardized_name}</strong><small>{item.firstDate} → {item.lastDate}</small></td>
                      <td><span className="parent-name">{item.parent_corporation}</span><Ticker>{item.ticker}</Ticker></td>
                      <td className="muted-cell">{company ? `${company.gross_margin_pct}%` : '—'}</td>
                      <td className="muted-cell">{formatCurrency(item.earliestUnitPrice)}</td>
                      <td>{formatCurrency(item.latestUnitPrice)}</td>
                      <td><span className={`change-pill ${item.priceChangePct >= 0 ? 'change-up' : 'change-down'}`}>{item.priceChangePct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{item.priceChangePct === null ? '—' : `${item.priceChangePct > 0 ? '+' : ''}${item.priceChangePct}%`}</span></td>
                      <td className="muted-cell">{formatCurrency(item.priceChangeAbs)}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          ) : <EmptyState>Need at least two bills with the same item to compare price changes.</EmptyState>}
          <div className="panel-footnote"><span>Same standardized item, earliest vs. latest recorded unit price.</span><span>PRICE CHANGE IS NOT ADJUSTED FOR INFLATION OR PACKAGE SIZE</span></div>
          {topHike && <span className="sr-only">Biggest price hike: {topHike.standardized_name}, {topHike.priceChangePct}%</span>}
        </Panel>

        <Panel className="breakdown-panel">
          <PanelHeading
            eyebrow="THE BRANDS YOU BUY. THE STORES YOU VISIT."
            title="Brand & Merchant Breakdown"
            action={(
              <div className="segmented-control" role="tablist" aria-label="Breakdown view">
                <button className={breakdown === 'brands' ? 'selected' : ''} onClick={() => setBreakdown('brands')} role="tab" aria-selected={breakdown === 'brands'}><Tags size={14} /> Brands</button>
                <button className={breakdown === 'merchants' ? 'selected' : ''} onClick={() => setBreakdown('merchants')} role="tab" aria-selected={breakdown === 'merchants'}><ReceiptText size={14} /> Merchants</button>
              </div>
            )}
          />
          {breakdown === 'brands' ? (
            analysis?.brandRanking.length ? (
              <div className="breakdown-grid">
                {analysis.brandRanking.slice(0, 8).map((brand, index) => (
                  <div className="breakdown-item" key={brand.key}>
                    <div className="breakdown-item-top"><span className="brand-rank">{String(index + 1).padStart(2, '0')}</span><span className="breakdown-spend">{formatCurrency(brand.totalSpent)}</span></div>
                    <strong>{brand.brand}</strong>
                    <span className="breakdown-parent">{brand.parent_corporation}</span>
                    {brand.controlTag && <span className="breakdown-parent">{brand.controlTag}</span>}
                    <div className="breakdown-bar"><span style={{ width: `${Math.min(brand.sharePct, 100)}%`, background: COLORS[index % COLORS.length] }} /></div>
                    <div className="breakdown-meta"><Ticker>{brand.ticker}</Ticker><span>{brand.itemCount} items · {brand.sharePct.toFixed(1)}% wallet</span></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState />
          ) : (
            analysis?.merchantsRanking.length ? (
              <div className="merchant-grid">
                {analysis.merchantsRanking.map((merchant, index) => (
                  <div className="merchant-card" key={merchant.key}>
                    <div className="merchant-icon"><ReceiptText size={17} /></div>
                    <div className="merchant-details"><strong>{merchant.name}</strong><span>{merchant.channel} · {merchant.billCount} {merchant.billCount === 1 ? 'bill' : 'bills'}</span></div>
                    <div className="merchant-amount"><strong>{formatCurrency(merchant.totalSpent)}</strong><span>{merchant.sharePct.toFixed(1)}% of total</span></div>
                    <Ticker muted>{merchant.ticker || `#${index + 1}`}</Ticker>
                  </div>
                ))}
              </div>
            ) : <EmptyState />
          )}
        </Panel>

        <footer className="dashboard-footer">
          <div><span className="brand-mark footer-mark"><BarChart3 size={14} /></span><span>WHO CONTROLS YOUR BILL?</span></div>
          <p>Estimates based on reported company-wide margins and your imported receipts. Not investment or financial advice.</p>
          <button onClick={() => setActiveModal('methodology')}><BriefcaseBusiness size={13} /> Methodology & legal</button>
          <button onClick={() => setActiveModal('data')}><Download size={13} /> Manage your data</button>
        </footer>
      </div>

      {activeModal === 'prompt' && <PromptModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'data' && (
        <DataManagerModal
          onClose={() => setActiveModal(null)}
          onDataChange={handleDataChange}
          onNotify={setNotice}
        />
      )}
      {activeModal === 'share' && hasData && (
        <ShareCardModal
          analysis={analysis}
          period={period}
          biggestHike={topHike}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'methodology' && <MethodologyModal onClose={() => setActiveModal(null)} />}
      {selectedItem && (
        <ItemInspectorModal
          key={selectedItem.key}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={() => setAnalysisRevision((revision) => revision + 1)}
          onNotify={setNotice}
        />
      )}

      {notice && <div className="toast" role="status"><span className="toast-check">✓</span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
    </main>
  )
}

export default App
