# Who Controls Your Bill?

**Live App:** [**https://jeffbZhao.github.io/who-controls-your-bill/**](https://jeffbZhao.github.io/who-controls-your-bill/)

**Who Controls Your Bill?** is an independent, local-first spending analysis tool. It helps people look beyond the store name on a receipt and explore which brands, parent companies, retailers, and upstream supply-chain entities are connected to everyday purchases.

The project is built around a simple idea: spending data can tell a more useful story when people can inspect the assumptions, correct supplier matches, and keep their financial records 100% under their own control in their local browser.

## What it does

- **Multi-Period Bill Analytics:** Analyzes retail, grocery, utility, telecom, and other bill data over selectable date ranges.
- **Conglomerate & Concentration Tracking (CR3):** Groups spending by merchant, brand, parent company, and sector to calculate top-3 wallet concentration.
- **Value-Chain Margin Waterfall:** Estimates how spending and consolidated gross/net margins are divided between retail gatekeepers and upstream producers.
- **Unit Price Variance Tracker:** Tracks comparable unit prices over time across receipts to highlight item-level price shifts.
- **Interactive Supply-Chain Inspector:** Lets you inspect item-level supplier matches, switch between community candidates, query Open Food Facts live, or save custom local overrides.
- **Instant Sandbox Mode:** Includes synthetic North American demo bills out of the box so the dashboard can be explored immediately before importing personal data.

## Receipt extraction: bring your own AI (BYO-AI)

The app does not connect to a backend AI provider or require an API key. Instead, you choose the AI service and workflow:

1. Open **Get AI Prompt** in the app and copy the supplied extraction instructions.
2. Provide receipt or bill images directly to an AI service of your choice (ChatGPT, Claude, Gemini, etc.) along with the prompt.
3. Ask the service to return structured JSON and review the result for accuracy.
4. Import the JSON into the app by pasting it or selecting a local `.json` backup file (automatic fingerprint deduplication prevents double-counting).

The prompt asks for visible evidence only, preserves unknown or unreadable values as `null`, and separates the retail merchant from each item's brand and parent corporation. Documents are shared with an external AI service only if you choose to upload them there.

## Four-tier supply-chain resolution

Supplier attribution is resolved using the best available information in this order:

1. **Your local supplier overrides:** Any correction you save for an item in the Inspector takes top precedence in your browser.
2. **Curated community SKU mappings (`public/community-sku-mappings.json`):** Bundled mappings match product SKUs or names, optionally constrained by merchant, and include candidate suppliers with estimated share breakdowns.
3. **Open Food Facts API:** From an item's inspector, you can explicitly search by barcode or product name. A usable result is cached and saved as a local override when you apply it.
4. **Receipt & bundled corporate fundamentals (`public/tickers-fundamentals.json`):** Extracted brands, parent companies, and stock tickers are matched against bundled public-company financial filings and known private-company aliases. Unresolved products remain classified as unmapped rather than being presented as verified suppliers.

*Note: These are illustrative estimates, not proof of a specific item's manufacturing origin. Receipt text, public product records, community mappings, and company-wide data can be incomplete. Inspect and override matches as needed.*

## Value-chain margin methodology

Every store-bought item involves both a retail channel and an upstream producer. The analysis attributes item spend across the retailer and upstream company, then applies each entity's reported company-wide gross- and net-margin percentages to its attributed spend:

- **Value-Chain Split (Default):** The retailer's consolidated gross-margin percentage is used as the retailer's share; the remaining wholesale portion is attributed to the upstream producer.
- **Alternative Views:** Switch seamlessly between **50/50 Fresh Split**, **Upstream Brands Only**, and **Retail Gatekeepers Only**.

Unbranded or unmapped fresh goods divide spend between the retailer and an independent/unmapped agribusiness bucket (excluded from CR3 concentration) rather than guessing a specific corporation. Taxes and environmental/bottle fees are excluded from product rankings, and item-matched discounts are netted against item spend.

**Important Disclaimer:** All margin figures apply consolidated public company-wide margins (from latest annual/10-K reports) or sector benchmarks to attributed receipt spend. They are **not SKU-level margins, audited purchase-level profits, or financial/investment advice**. All company names, brands, and stock tickers are the property of their respective owners and are used strictly for nominative identification and comparative educational analysis.

## Local-first privacy

Imported bills, item overrides, and lookup cache entries are stored strictly in your browser's **IndexedDB** database. The app has no backend server, no analytics tracking, and never uploads your receipts anywhere.

Use the in-app **Manage Data** modal to export your local bills as a `.json` backup file so you can restore or migrate them across devices at any time.

## Contributing to the Community SKU Dictionary

Found the upstream supplier or packing plant for a common grocery item or store-brand SKU?
1. Click the item in the **Item-Level Supply Chain Inspector** on the dashboard.
2. Enter the Brand, Parent Corporation, and Ticker (if publicly traded), then click **Copy JSON for GitHub Dictionary**.
3. Open an Issue or Pull Request adding the snippet to [`public/community-sku-mappings.json`](./public/community-sku-mappings.json). *(Please only submit objective product-to-supplier mappings; never include personal receipt data.)*

## Run locally

Requirements: Node.js 18+ and npm.

```bash
npm ci
npm run dev
```
## To create and preview a production build:
```bash
npm run build
npm run preview
```
## License
Released under the MIT License. Provided "AS IS" without warranty of any kind for educational and informational purposes only.
