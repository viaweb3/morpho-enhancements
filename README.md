# Morpho Enhancements

**English** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Русский](README.ru.md) · [Español](README.es.md)

A Chrome extension that fills four gaps in [app.morpho.org](https://app.morpho.org):

1. **Market-level Supply & Withdraw** — on any Morpho Blue market page, the official UI offers Borrow only. This extension injects a **Lend** tab next to Borrow that deposits the loan asset directly into the market (same `Morpho.supply()` call vaults use internally) and lets you withdraw later — so you can earn market-specific lending interest without going through a MetaMorpho vault.

2. **Dashboard visibility** — the dashboard lists vault deposits and borrow positions, but not direct-market supplies. This extension adds a **Market Lending** card that shows every market where the user is a direct lender, across every chain Morpho supports, with USD value, APY, and a shortcut back to the market page.

3. **Favorites** on `/markets` and `/vaults` — star any row, then toggle a **Favorites only** chip to filter the list down to the handful you actually care about. Favorites persist in-browser and sync across tabs.

4. **Toolbar popup** — click the extension icon for an instant quick-view: *Prime* tab lists 19 hand-curated blue-chip markets across Mainnet / Base / Arbitrum / OP with live supply APY, TVL, utilization, and LLTV; *Favorites* tab shows everything you've starred (V1 and V2 vaults, markets) with the same live data. Sort by APY or TVL. Click any row to jump to the corresponding page on app.morpho.org.

<p align="center">
  <img src="docs/screenshots/market-lend-light.png" width="360" alt="Market page — Lend tab (light)">
  <img src="docs/screenshots/market-lend-dark.png" width="360" alt="Market page — Lend tab (dark)">
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-card-light.png" width="720" alt="Dashboard — Market Lending card (light)">
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-card-dark.png" width="720" alt="Dashboard — Market Lending card (dark)">
</p>

<p align="center">
  <img src="docs/screenshots/favorites-markets-light.png" width="720" alt="Markets list — stars on each row, Favorites chip (light)">
</p>

<p align="center">
  <img src="docs/screenshots/favorites-markets-filtered-light.png" width="720" alt="Markets list filtered to favorites (light)">
</p>

<p align="center">
  <img src="docs/screenshots/popup-prime-light.png" width="320" alt="Toolbar popup — Prime tab (light)">
  <img src="docs/screenshots/popup-favorites-light.png" width="320" alt="Toolbar popup — Favorites tab (light)">
</p>

<p align="center">
  <img src="docs/screenshots/popup-prime-dark.png" width="320" alt="Toolbar popup — Prime tab (dark)">
  <img src="docs/screenshots/popup-favorites-dark.png" width="320" alt="Toolbar popup — Favorites tab (dark)">
</p>

> Dashboard screenshots use mocked position data. Real balances, addresses, and market hashes are never part of published images.

## Features

- **Borrow | Lend tabs** on the market panel. Clicking Lend swaps the native form for a supply / withdraw UI that matches Morpho's visual language in both light and dark mode.
- **ETH / WETH wrap toggle** when the loan asset is the chain's wrapped-native token. Pay with native ETH (or POL on Polygon, MON on Monad, HYPE on HyperEVM) — the extension auto-wraps before supply and auto-unwraps after withdraw. Two signatures total; no separate wrap UX trip.
- **Multi-chain dashboard** — Market Lending card queries every chain Morpho supports in one request. The live chain list is maintained in [src/services/chain/morphoSupportedChains.ts](src/services/chain/morphoSupportedChains.ts).
- **Favorites on list pages** — star markets and vaults in `/markets` and `/vaults`, then filter the table down to just your picks with a one-click chip. Stored in `chrome.storage.local` only (no server, no tracking); syncs across tabs and into the toolbar popup via `chrome.storage.onChanged`.
- **Toolbar popup** with two tabs — *Prime* (19 hand-curated blue-chip markets across Mainnet / Base / Arbitrum / OP) and *Favorites* (your starred markets and vaults; V1 and V2 MetaMorpho both supported with a small `V1`/`V2` chip). Stale-while-revalidate caching: 5-minute in-memory + `chrome.storage.local` persistence so reopening the popup paints last-known data instantly while a fresh fetch runs in the background. Sort by APY ↓ or TVL ↓.
- **Reuses the page's wallet** — no second connect flow. Works with MetaMask, Rabby, Frame, Coinbase Wallet, and any EIP-6963–compliant injection.
- **Non-standard ERC-20 support** — USDT (and other tokens whose `approve` returns no data) work out of the box; the approve ABI is declared with no outputs so viem's simulation doesn't fail on `0x`.
- **Humanized errors** — rejecting a signature silently returns to idle. Insufficient balance, wrong network, stuck nonce, and revert reasons become short sentences instead of a 2 KB viem dump.
- **No analytics, no telemetry, no hosted backend** — direct calls to the Morpho Blue contract via public RPCs, plus Morpho's own blue-api for APY/USD figures.

## How it works

- **Contracts** — all reads/writes go through the Morpho Blue singleton at `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` (deterministic CREATE2 on every supported chain). `idToMarketParams(id)` resolves the URL market id to on-chain params; `supply(params, assets, 0, onBehalf, "0x")` handles the deposit; `position(id, user)` + `market(id)` feed balance math.
- **Wallet bridge** — a `world: "MAIN"` content script implements EIP-6963 discovery (plus legacy `window.ethereum` fallback) and proxies EIP-1193 requests via `window.postMessage` to the isolated content script. The UI builds a viem `WalletClient` on top and never holds keys.
- **Data** — lightweight GraphQL against `https://blue-api.morpho.org/graphql` for APY and USD. Shares-to-assets math is also ported locally in `sharesMath.ts` for direct on-chain reads.
- **UI** — React 19 mounted inside a Shadow DOM so the extension's styles don't leak into (or out of) Morpho's page. SPA navigation is caught by patching `history.pushState` / `replaceState` and a throttled `MutationObserver` that ignores animation-driven churn.

## Supported chains

| slug (URL) | chainId | native / wrapped-native |
|---|---|---|
| `ethereum` | 1 | ETH / WETH |
| `base` | 8453 | ETH / WETH |
| `arbitrum` | 42161 | ETH / WETH |
| `opmainnet` | 10 | ETH / WETH |
| `polygon` | 137 | POL / WPOL |
| `unichain` | 130 | ETH / WETH |
| `monad` | 143 | MON / WMON |
| `world-chain` | 480 | ETH / WETH |
| `katana` | 747474 | ETH / WETH |
| `hyperevm` | 999 | HYPE / WHYPE |

Slugs are sourced from `app.morpho.org/sitemap.xml`; addresses from [`morpho-blue-api-metadata`](https://github.com/morpho-org/morpho-blue-api-metadata).

## Install

### From GitHub Releases (recommended while Chrome Web Store review is pending)

Each `v*` tag triggers a GitHub Actions build that attaches the ZIP to the
[Releases page](../../releases). To install:

1. Download `morpho-enhancements-<version>-unpacked.zip` from the latest release
2. Unzip it somewhere stable (e.g. `~/extensions/morpho-enhancements/`)
3. Open `chrome://extensions`
4. Toggle **Developer mode** on (top-right)
5. Click **Load unpacked** → pick the unzipped folder

Chrome will show "Developer mode extension" warnings — that's expected for any
locally-installed extension. Reviews in the Chrome Web Store unlock the
one-click install experience but take days; this path is identical in
functionality.

### From source (dev)

```bash
pnpm install
pnpm build
# Chrome → chrome://extensions → enable Developer mode → Load unpacked → select ./dist
```

Iterate with `pnpm dev` (Vite + crxjs HMR).

## Tests

```bash
# DOM probe against the live site (captures anchors + sample layout JSON)
pnpm probe

# End-to-end — launches Chromium with the built extension. Covers: Lend tab,
# dashboard mount, dark-mode legibility, provider bridge, favorites star + filter,
# and the toolbar popup (tabs, sort, V1/V2 vault rendering, chrome.storage cache).
pnpm test:e2e
```

Regenerate README screenshots (GraphQL responses are mocked so no real balances leak):

```bash
pnpm exec playwright test tests/e2e/screenshots.spec.ts
```

## Project layout

```
src/
├── manifest.config.ts        # MV3 manifest declaration
├── content/
│   ├── main.ts               # ISOLATED world — SPA route watcher + mount dispatcher
│   ├── mount.ts              # Shadow DOM host + React root + theme sync
│   ├── router.ts             # pushState/replaceState → locationchange event
│   ├── marketIntegration.ts  # Borrow | Lend tab injection on the market panel
│   └── listsIntegration.ts   # Favorites star + filter chip on /markets and /vaults
├── lib/
│   ├── morpho.ts             # viem public client + Morpho contract helpers
│   ├── morphoAbi.ts          # IMorpho + ERC20 + WETH9 ABIs
│   ├── sharesMath.ts         # SharesMathLib port (virtual shares/assets)
│   ├── chains.ts             # Slug ↔ chain ID, wrapped-native, RPC fallback list
│   ├── url.ts                # Route matcher (market / dashboard / list / other)
│   ├── favorites.ts          # chrome.storage.local-backed favorites + cross-tab sync + E2E bridge
│   ├── graphql.ts            # blue-api client (markets, V1/V2 vaults, batch + SWR cache)
│   └── pageProvider.ts       # Bridge client + viem WalletClient adapter
├── ui/
│   ├── MarketLendForm.tsx    # Market-page supply / withdraw form (with wrap toggle)
│   ├── DashboardSupplyCard.tsx
│   ├── errorMessage.ts       # viem error → short user-friendly message
│   ├── format.ts             # bigint / USD / percent formatters
│   └── styles.css            # Shadow-DOM-scoped theme tokens
├── popup/
│   ├── index.html            # MV3 toolbar popup entry
│   ├── main.tsx              # React root
│   ├── Popup.tsx             # Tabs (Prime / Favorites), sort bar, rows, refresh
│   ├── TokenIcon.tsx         # Logo loader (Morpho CDN → letter avatar fallback)
│   └── popup.css             # Brand banner, tabs, rows, light + dark
├── data/
│   └── curatedMarkets.ts     # Prime-tier watch list (19 markets, hand-maintained)
public/
├── icons/                    # Generated by scripts/make-logo.py (16/32/48/128)
├── logo.svg                  # Master vector (Morpho butterfly + enhancement badge)
└── injected/
    └── provider-bridge.js    # Plain-JS MAIN-world bridge (not bundled with app code)
scripts/
├── make-logo.py              # Regenerates extension icons from morpho-base.svg
└── morpho-base.svg           # Official Morpho butterfly (source)
tests/
├── probe/                    # DOM scrapes against app.morpho.org
└── e2e/
    ├── extension.spec.ts     # Lend tab, dashboard mount, dark mode, provider bridge
    ├── favorites.spec.ts     # Star + filter + persistence (uses postMessage test bridge)
    ├── popup.spec.ts         # Toolbar popup — tabs, sort, V1/V2 vault, cache, refresh
    └── screenshots.spec.ts   # README / store-listing screenshots (mocked data)
```

## Security

- Reads contract state via public RPC endpoints (viem fallback across 4 providers per chain). Writes go through the user's wallet — the extension never holds or requests private keys.
- All writes are simulated via `simulateContract` before `writeContract`, so reverts surface as readable errors before the wallet prompt.
- Full-withdraw uses shares (not assets) to avoid precision reverts on interest accrual; partial withdraw uses assets within a 0.01% tolerance.
- Host permissions limited to `https://app.morpho.org/*`. The only Chrome API used is `chrome.storage.local` (for favorites and the popup data cache); no data is sent to any service other than the user-configured RPCs, `blue-api.morpho.org`, and Morpho's CDN (`cdn.morpho.org`) for token logos.

## Known limitations

- **One-tx wrap-and-supply** isn't implemented yet. Morpho's Bundler / GeneralAdapter could fold wrap + approve + supply into a single multicall; this extension does them as 2–3 separate signatures. Works, just more clicks.
- **WalletConnect-only sessions** that don't expose an injected EIP-1193 provider on the page won't be picked up by the bridge.
- **Bundle size** is ~530 KB pre-gzip, dominated by viem. A later release will dynamic-import viem's chain / contract code paths.

## Publishing

See [`docs/PUBLISHING.md`](docs/PUBLISHING.md) for the Chrome Web Store submission walkthrough (zip structure, listing copy, privacy disclosures, review tips).

## License

MIT — see [LICENSE](LICENSE).

This project is not affiliated with Morpho Labs. "Morpho" and the Morpho butterfly mark are trademarks of their respective owners; the base logo file (`scripts/morpho-base.svg`) is served by Morpho's public CDN.
