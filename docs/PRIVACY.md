# Privacy Policy — Morpho Enhancements

_Last updated: 2026-08-03_

This Chrome extension ("Morpho Enhancements") does not collect, store, or transmit personal information.

## What the extension does

- Runs **only** on pages under `https://app.morpho.org/*`.
- Reads the page DOM to inject its own UI (a Lend tab on market pages, a Market Lending card on the portfolio, and favorites stars on the `/variable` and `/vaults` list pages).
- Provides a toolbar popup (click the extension icon) showing live data for a curated set of Morpho markets and your starred favorites. Token logos are loaded from Morpho's CDN (`cdn.morpho.org`).
- Sends an allow-listed wallet request through the extension service worker only after you use its transaction UI. The worker validates the sender and executes one scoped EIP-6963 / EIP-1193 request; page scripts cannot invoke this path.
- Queries the Morpho Blue smart contract via public JSON-RPC endpoints (viem fallback: publicnode.com, ankr.com, cloudflare-eth.com, llamarpc.com, and chain-owned RPCs).
- Queries Morpho's public GraphQL API at `https://api.morpho.org/graphql` for APY and USD values.
- Stores the list of markets / vaults you mark as favorites in `chrome.storage.local` under the extension's own origin (key: `morpho-ext:favorites`). This is a plain JSON array of `kind:chain:address` strings. It stays on your device, is never transmitted anywhere, and can be cleared at any time by removing the extension or via `chrome://extensions → Morpho Enhancements → Site access`.
- Stores a small cache of last-seen Morpho market and vault data (APY, TVL, utilization) in `chrome.storage.local` (key: `morpho-ext:popup-cache`) so the toolbar popup paints with last-known values instantly on next open. Cleared by the in-popup refresh button or by removing the extension. Contains no personal data — only public on-chain figures already shown by Morpho's own UI.

## What the extension does NOT do

- Collect or transmit personal information, browsing history, location, or device identifiers.
- Use analytics, telemetry, or third-party tracking of any kind.
- Hold, read, or request private keys — every transaction is signed by the wallet the user already connected to the page.
- Run code fetched from a remote server. All JavaScript is shipped inside the extension package.
- Talk to any host other than `app.morpho.org`, the configured JSON-RPC providers, Morpho's public API, and Morpho's token-logo CDN.

## Third parties

When you interact with the extension, your browser makes outgoing requests to:

- The public JSON-RPC endpoints listed above — governed by each provider's own privacy policy.
- `https://api.morpho.org/graphql` — Morpho Labs' public indexer. No authentication header, no user identifier beyond the wallet address you voluntarily pass as a query parameter.
- `https://cdn.morpho.org/*` — token logo images.

The wallet address that you view a portfolio for (e.g. `/portfolio/0x…`) is included in the GraphQL request so the indexer can return positions for it. That address is already public on-chain and is typed into the URL by the user.

## Contact

Issues, questions, or pull requests: https://github.com/viaweb3/morpho-enhancements

## Changes

If this policy ever changes, the new version will live in the git history of this file. A non-trivial change will also bump the extension's version in the Chrome Web Store.
