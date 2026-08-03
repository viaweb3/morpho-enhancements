# Changelog

All notable changes to Morpho Enhancements are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[SemVer](https://semver.org/).

## [0.4.0] — 2026-08-03

### Changed

- Updated all integrations to Morpho's current `/variable` market list,
  `/{chain}/variable/{marketId}/{slug}` market, and `/portfolio/{address}` routes.
- Matched the Lend panel to Morpho's native Borrow controls, input and summary
  cards, typography, spacing, token icons, light/dark themes, and primary action.
- Replaced the page-level wallet bridge with a sender-validated service worker
  and allow-listed, single-request MAIN-world execution. Multiple injected
  wallets are pinned to the connected account.
- Batched popup market queries by chain, paginated dashboard positions, added
  GraphQL timeouts, and made dashboard layout responsive.

### Fixed

- Keep the wallet connection action enabled before an amount is entered.
- Reject mismatched on-chain market parameters, over-precision token amounts,
  wrong wallet networks/accounts, failed transaction receipts, and stale data
  refresh failures before continuing a transaction flow.
- Use exact ERC-20 approvals with a zero-reset fallback and reserve dynamic
  native gas before wrapping.

### Internal

- Added focused unit coverage, native Borrow/Lend geometry assertions, live DOM
  probes, extension E2E coverage, deterministic screenshot tests, and a complete
  `pnpm test:release` release gate.
- Added CI typecheck, unit-test, and production-build gates; release builds also
  run extension E2E before packaging.

## [0.3.0] — 2026-04-26

### Added

- **Toolbar popup with Prime and Favorites tabs.** Click the
  extension icon to see a quick-view panel listing live supply APY,
  utilization, and LLTV for a curated set of blue-chip Morpho Blue
  markets (the default Prime tab) and your starred markets and vaults
  (the Favorites tab). Each row links straight to the market or
  vault page on `app.morpho.org`.
- Refresh button in the popup header clears every cache layer and
  re-fetches from `blue-api.morpho.org`.
- **Stale-while-revalidate caching**: market and vault results persist
  to `chrome.storage.local` (~1 KB each), so the next time the popup
  opens it paints with last-known data instantly while a fresh fetch
  runs in the background and swaps in updated values when ready.
  In-memory results stay fresh for 5 minutes (was 30 s).
- Curated list ports the Mainnet / Base / Arbitrum / OP Prime-tier
  watch list maintained alongside the author's monitor pipeline.
- **Token icons** on every popup row, served from `cdn.morpho.org`
  (URL ships with each `Asset` via blue-api's `logoURI` field — no
  extra permission, no extra round-trip). Two-stage fallback: when
  the API doesn't provide a logoURI, a guess at the conventional
  `cdn.morpho.org/assets/logos/{symbol}.svg` path is tried before
  the per-symbol colored letter avatar.
- **V1/V2 version chip** on favorited vault rows so users can tell
  MetaMorpho V1 from MetaMorpho V2 vaults at a glance. V2 chips use
  the brand-blue tint to mirror the new generation Morpho is
  promoting.
- **Sort sub-bar** (Default · APY ↓ · TVL ↓) under the tabs. Sort
  applies to both Curated and Favorites lists; defaults to the
  list's natural order.

### Changed

- **Favorites store migrated from `localStorage` to
  `chrome.storage.local`** so the popup (extension origin) and the
  content script (`app.morpho.org` origin) share a single source of
  truth. A one-time on-load migration copies any pre-existing
  `morpho-ext:favorites` entry from the page's `localStorage` into
  `chrome.storage.local` and removes the legacy key. Cross-tab sync
  now uses `chrome.storage.onChanged`.
- Manifest gains the `storage` permission (low-sensitivity, expected
  for any extension that persists user preferences).

### Internal

- Added `src/popup/` (HTML entry, React app, CSS).
- Added `src/data/curatedMarkets.ts` (typed list of curated markets).
- Extended `src/lib/graphql.ts` with `fetchMarketsBatch`,
  `fetchVaultsBatch`, a `vaultByAddress` query, a 30-second in-memory
  cache shared by the popup tabs, and `logoURI` on every Asset
  selection.
- Migrated the market query from the deprecated `marketByUniqueKey`
  (removal scheduled 2026-07-01) to the new `marketById` resolver.
- Vault favorites now resolve via a single GraphQL request that asks
  both `vaultByAddress` (V1) and `vaultV2ByAddress` (V2) by alias and
  uses whichever matches — favorites starred from V2 vaults like
  `sky.money USDT Savings` no longer render as a raw address.

## [0.2.0] — 2026-04-22

### Added

- **Favorites on `/markets` and `/vaults` list pages.** A star button is
  injected on every row; click to bookmark a market or vault. A
  bottom-left floating chip toggles a "Favorites only" filter that hides
  all non-favorited rows. Favorites persist per-origin via
  `localStorage` (`morpho-ext:favorites`) and sync across tabs.
- Favorites-only filter shows a live count badge (`Favorites only · 3`).
- Screenshots for the favorites feature at 1440×900 (docs) and 1280×800
  (Chrome Web Store listing), light + dark.

### Fixed

- **USDT-style approve reverts.** `approve` on USDT (and other
  non-standard ERC-20s) returns no data, which caused viem's
  `simulateContract` to fail decoding `0x` as `bool`. The ERC20 ABI now
  declares no outputs for `approve`, which works for both standard and
  non-standard tokens.

### Internal

- Added `src/lib/favorites.ts` (localStorage store, cross-tab sync).
- Added `src/content/listsIntegration.ts` (row star injection +
  filter chip + document-level capture-phase click delegation so
  Morpho's Next.js router doesn't swallow the star click).
- Route matcher (`src/lib/url.ts`) recognizes `/markets` and `/vaults`
  as first-class routes.
- New E2E spec `tests/e2e/favorites.spec.ts` covers single, multi-select,
  and cross-page persistence.

## [0.1.0] — 2026-04-21

Initial release.

- Market-level Supply / Withdraw via an injected **Lend** tab.
- Multi-chain **Market Lending** card on the dashboard (10 chains).
- ETH / WETH wrap toggle on wrapped-native markets.
- EIP-6963 / EIP-1193 provider bridge (reuses the page's wallet).
- Humanized error messages for common revert / rejection cases.
- Chrome Web Store listing images at 1280×800.

[0.4.0]: https://github.com/viaweb3/morpho-enhancements/releases/tag/v0.4.0
[0.3.0]: https://github.com/viaweb3/morpho-enhancements/releases/tag/v0.3.0
[0.2.0]: https://github.com/viaweb3/morpho-enhancements/releases/tag/v0.2.0
[0.1.0]: https://github.com/viaweb3/morpho-enhancements/releases/tag/v0.1.0
