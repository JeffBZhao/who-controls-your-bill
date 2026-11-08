# Who Controls Your Bill?

**Who Controls Your Bill?** is an independent, local-first spending analysis tool. It helps people look beyond the store name on a receipt and explore which brands, parent companies, retailers, and other parts of the supply chain are connected to everyday purchases.

The project is built around a simple idea: spending data can tell a more useful story when people can inspect the assumptions, correct supplier matches, and keep their receipts under their own control.

## What it does

- Analyzes retail, utility, telecom, and other bill data over selectable date ranges.
- Groups spending by merchant, brand, parent company, and sector.
- Estimates how value may be divided between a retailer and an upstream supplier.
- Tracks comparable unit prices over time when receipts contain consistent product details.
- Lets you inspect supplier matches, review community candidates, and save corrections.
- Includes synthetic demo bills so the dashboard can be explored before importing personal data.

## Receipt extraction: bring your own AI

The app does not connect to an AI provider or require an API key. Instead, you choose the AI service and workflow:

1. Open **Get AI Prompt** and copy the supplied extraction instructions.
2. Provide receipt or bill images directly to an AI service of your choice, along with the prompt.
3. Ask the service to return structured JSON and review the result for accuracy.
4. Import the JSON into the app by pasting it or selecting a local JSON file.

The prompt asks for visible evidence only, preserves unknown or unreadable values as null, and separates the merchant from each item's brand and parent corporation. You are responsible for reviewing AI output before importing it. Documents are shared with an external AI service only if you choose to upload them there.

## Four-tier supply-chain resolution

Supplier attribution is resolved using the best available information in this order:

1. **Your local supplier overrides.** A correction you save for an item takes precedence in this browser.
2. **Curated community SKU mappings.** Bundled mappings match product identifiers or names, optionally constrained by merchant, and can include multiple candidate suppliers and their estimated shares.
3. **Open Food Facts.** From an item's inspector, you can explicitly search by barcode or product name. A usable result is saved as a local override when you apply it. The entered query is sent to Open Food Facts for that search.
4. **Receipt and bundled company data.** If the earlier sources do not resolve an item, its extracted brand, parent company, and ticker are checked against bundled public-company fundamentals and known private-company aliases. Unresolved products remain classified as unknown or unmapped rather than being presented as verified suppliers.

These are estimates, not proof of a product's manufacturing origin. Receipt text, public product records, community mappings, and company-wide data can all be incomplete or incorrect. Inspect and correct matches before relying on an analysis.

## Value-chain margin methodology

The analysis attributes item spend across the retailer and upstream company, then applies each entity's bundled gross- and net-margin percentages to its attributed spend to estimate illustrative gross and net profit. In the default **Value chain** view, the retailer's gross-margin percentage is used as the retailer's share; the remainder is attributed upstream. Other views include an equal 50/50 split, upstream-only, and retailer-only.

Unbranded or unmapped goods receive special handling because their supplier cannot be identified reliably. Where a retailer is known, the default view divides this spend between the retailer and an independent/unmapped category rather than guessing a producer. Taxes and fees are not treated as product purchases; discounts are applied to matched items where possible.

These figures apply consolidated company margins to attributed receipt spend. They are **not product-level margins, audited purchase-level profits, or investment advice**. Assumptions, incomplete data, or a mistaken supplier match can materially change the estimates. See the in-app **Methodology** panel for additional caveats.

## Local-first privacy

Imported bills, item overrides, and Open Food Facts lookup cache entries are stored in the browser's **IndexedDB** database. The app has no receipt-upload backend and does not automatically send receipts to an AI service. Data stays in that browser unless you choose to export a backup or share it yourself.

There are two important exceptions to keep in mind:

- An explicit Open Food Facts search sends the barcode or product name you enter to Open Food Facts.
- An AI service receives documents only if you upload them to that service yourself.

Use the app's backup feature to export your local bills. Clearing local bill data is permanent unless you have an exported backup. Do not put personal receipts, exported backups, or other private data in a public repository.

## Run locally

Requirements: Node.js 22.x and npm.

```bash
npm ci
npm run dev
```

Vite prints a local development URL in the terminal. To create and preview a production build:

```bash
npm run build
npm run preview
```

Run the configured linter with:

```bash
npm run lint
```

## Deploy to GitHub Pages

The workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds and deploys the app when changes are pushed to `main` (and can also be started manually from the Actions tab). In the repository's **Settings → Pages**, select **GitHub Actions** as the deployment source.

Vite is configured with a relative asset base so the built app works from a GitHub Pages project URL as well as a root URL.
