# Privacy Policy — Morpho Enhancements

_Last updated: 2026-04-22_

This Chrome extension ("Morpho Enhancements") does not collect, store, or transmit personal information.

## What the extension does

- Runs **only** on pages under `https://app.morpho.org/*`.
- Reads the page DOM to inject its own UI (a Lend tab on market pages, a Market Lending card on the dashboard, and favorites stars on the `/markets` and `/vaults` list pages).
- Uses the EIP-6963 / EIP-1193 wallet provider that the page itself already surfaces, so you can supply and withdraw without a second wallet-connect flow.
- Queries the Morpho Blue smart contract via public JSON-RPC endpoints (viem fallback: publicnode.com, ankr.com, cloudflare-eth.com, llamarpc.com, and chain-owned RPCs).
- Queries Morpho's public GraphQL API at `https://blue-api.morpho.org/graphql` for APY and USD values.
- Stores the list of markets / vaults you mark as favorites in the browser's `localStorage` under the `app.morpho.org` origin (key: `morpho-ext:favorites`). This is a plain JSON array of `kind:chain:address` strings. It stays on your device, is never transmitted anywhere, and can be cleared at any time by deleting site data for `app.morpho.org`.

## What the extension does NOT do

- Collect or transmit personal information, browsing history, location, or device identifiers.
- Use analytics, telemetry, or third-party tracking of any kind.
- Hold, read, or request private keys — every transaction is signed by the wallet the user already connected to the page.
- Run code fetched from a remote server. All JavaScript is shipped inside the extension package.
- Talk to any host other than `app.morpho.org`, the configured JSON-RPC providers, and Morpho's own blue-api and token-logo CDN.

## Third parties

When you interact with the extension, your browser makes outgoing requests to:

- The public JSON-RPC endpoints listed above — governed by each provider's own privacy policy.
- `https://blue-api.morpho.org/graphql` — Morpho Labs' public indexer. No authentication header, no user identifier beyond the wallet address you voluntarily pass as a query parameter.
- `https://cdn.morpho.org/*` — token logo images.

The wallet address that you view a dashboard for (e.g. `/dashboard/0x…`) is included in the GraphQL request so the indexer can return positions for it. That address is already public on-chain and is typed into the URL by the user.

## Contact

Issues, questions, or pull requests: https://github.com/<ORG>/morpho-enhancements

## Changes

If this policy ever changes, the new version will live in the git history of this file. A non-trivial change will also bump the extension's version in the Chrome Web Store.
