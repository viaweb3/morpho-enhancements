# Changelog

All notable changes to Morpho Enhancements are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[SemVer](https://semver.org/).

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

[0.2.0]: https://github.com/<ORG>/morpho-enhancements/releases/tag/v0.2.0
[0.1.0]: https://github.com/<ORG>/morpho-enhancements/releases/tag/v0.1.0
