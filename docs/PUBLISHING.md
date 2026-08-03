# Publishing to the Chrome Web Store

End-to-end checklist for getting this extension onto the Chrome Web Store. Read the whole thing before starting — a few of the pieces (privacy disclosures, promo images, review timing) are easy to get wrong on the first pass.

## 0. Prerequisites

- A Google account. Use a dedicated one if you plan to publish under a brand.
- A US $5 one-time **developer registration fee** paid at https://chrome.google.com/webstore/devconsole. Keeps the store clean of spam registrations.
- The built `dist/` folder produced by `pnpm build` (tested, up to date).

## 1. Package the upload ZIP

Chrome wants a single ZIP containing the extension's root — i.e. `manifest.json` must sit at the archive root, not inside a `dist/` folder.

```bash
# Runs unit tests, production build, live probes, extension E2E, screenshot
# generation, and creates the upload ZIP from the verified dist/ directory.
pnpm test:release

# Validate the final manifest and archive
cat dist/manifest.json | jq .
unzip -t dist-zip/morpho-enhancements-<version>.zip
```

Sanity-check things that trip up reviewers:

- `manifest.json` has the correct `version` (matches `package.json`).
- `icons` sizes 16 / 32 / 48 / 128 all exist and open cleanly.
- `permissions` and `host_permissions` list only what's actually used. Currently: `permissions: ["storage", "scripting"]` (local data plus sender-validated wallet RPC execution) and `host_permissions: ["https://app.morpho.org/*"]`.
- No source maps or Vite's internal manifest in production; `scripts/package-zip.mjs` excludes both.

The upload artifact is `dist-zip/morpho-enhancements-<version>.zip`. Do not zip
the `dist/` directory itself or reuse an archive from an earlier build.

## 2. Developer Dashboard — new item

1. Log in to https://chrome.google.com/webstore/devconsole.
2. Click **Add new item**, upload the ZIP. Chrome unpacks and runs a fast static scan; fix anything it yells about before continuing.
3. The listing splits into tabs — **Package**, **Privacy practices**, **Store listing**, **Distribution**. You can save drafts on each and submit when the whole set is green.

## 3. Store listing content

### Name
`Morpho Enhancements` (45 char max)

### Summary (short)
Up to 132 chars. Suggested:
> Supply / Withdraw on Morpho Blue markets, a multi-chain Market Lending dashboard card, and Favorites on market & vault lists.

### Description
Long form (up to ~16,000 chars). A usable draft:

> Morpho Enhancements adds three things to app.morpho.org:
>
> • **Market-level Supply & Withdraw** — every Morpho Blue market page gets a Lend tab next to Borrow. Deposit the loan asset directly into a specific market (not just a vault) to earn market-specific interest, and withdraw in the same UI.
>
> • **Dashboard visibility** — your direct-market lending positions show up on the dashboard, across every chain Morpho supports.
>
> • **Favorites on /variable and /vaults** — star any row; a Favorites-only chip filters the list down to just your picks. Kept in your browser only, works across tabs.
>
> The extension reuses the wallet you've already connected to Morpho — no separate connect flow. When the loan asset is the chain's wrapped-native token (WETH, WPOL, WMON, WHYPE), a small toggle lets you pay with the native currency and auto-wraps in the background.
>
> **Privacy / security:**
> – Runs only on app.morpho.org. No analytics, no telemetry.
> – Never holds private keys; every signature is yours.
> – Transactions are simulated before being sent so reverts become readable errors.
>
> Open source under MIT: https://github.com/viaweb3/morpho-enhancements

### Category
`Productivity`

### Language
`English (United States)` (add Chinese later if you translate the UI).

## 4. Visual assets

The dashboard has tight size rules. Use the screenshot generator:

```bash
pnpm exec playwright test tests/e2e/screenshots.spec.ts
```

Required:

| Asset | Pixel size | Notes |
|---|---|---|
| Store icon | 128 × 128 | `public/icons/icon-128.png` — already the right size. |
| Screenshot(s), min 1, max 5 | **1280 × 800** exact | Pre-built: `docs/screenshots/store-market-1280x800.png`, `store-dashboard-1280x800.png`, `store-market-dark-1280x800.png`, `store-dashboard-dark-1280x800.png`. Regenerate anytime with `pnpm screenshots`. |
| Small promo tile (optional) | 440 × 280 | Marketing — one-sentence tagline over the butterfly. |
| Marquee (optional) | 1400 × 560 | Only if Chrome features you; skip for a first submission. |

The four pre-built store shots cover: market page Lend tab (light + dark) and dashboard with Market Lending card (light + dark). All four render at the exact `1280 × 800` Chrome expects — no padding needed. Upload in that order; Chrome shows them in a carousel in the listing.

Keep all screenshots free of real wallet addresses / balances. The generator already mocks the GraphQL response so no real on-chain data leaks.

## 5. Privacy practices (the form that usually blocks submissions)

The dashboard will ask a handful of narrowed-down questions. For this extension the honest answers are:

- **Single purpose**: "Enhances the Morpho lending UI on app.morpho.org with market-level supply/withdraw, a dashboard lending summary, list-page favorites, and a toolbar popup quick-view of curated and starred markets."
- **Permission justifications**:
  - `host_permissions: https://app.morpho.org/*` — "Required to inject UI and read DOM on Morpho's own pages; the only site this extension touches."
  - `permissions: storage` — "Persists the user's market/vault favorites and a small cache of public on-chain figures (APY, TVL) so the toolbar popup paints with last-known data instantly. Stored locally in `chrome.storage.local`; never transmitted."
  - `permissions: scripting` — "Executes a single allow-listed wallet RPC request in the page's MAIN world after the extension service worker validates that it came from this extension's top-frame content script on app.morpho.org."
- **Remote code use**: No remote code is executed. The extension ships all JS in the ZIP; it calls HTTPS endpoints for JSON data only (RPC + Morpho API).
- **Data handling**:
  - Does not collect or transmit personal info, authentication info, location, health, financial-personal info, or user activity / web history beyond what's needed to render the injected UI on the one permitted host.
  - The wallet address the user connects is visible in-memory for the session but never leaves the device except in RPC / Morpho API requests that are part of the normal protocol interaction.
- **Privacy policy URL**: required even for a no-data extension. Host [`docs/PRIVACY.md`](./PRIVACY.md) as an HTML page on GitHub Pages or your own domain and paste the URL.

## 6. Distribution

- **Visibility**: start with **Unlisted** to smoke-test the install flow with a direct URL before going public. Switch to Public once you're happy.
- **Regions**: all.
- **Pricing**: free.

## 7. Submit & wait

Review takes anywhere from a few hours to several days. The most common rejections for a Web3 extension:

- **Unclear single purpose** — mention "Morpho" and "lending UI" explicitly in the summary and description. Don't market it as "DeFi toolkit".
- **Missing justification** — even one vague permission line blocks review. Be specific.
- **Screenshots with real PII** — mask addresses and balances before uploading.
- **Remote-code fetch** — don't lazy-load any JS from a URL (the RPC JSON is fine; JavaScript is not).

If rejected, the email explains why. Re-upload the ZIP under the same item; you don't pay again.

## 8. After approval

- Tag the git commit that produced the uploaded ZIP (`git tag v0.1.0 && git push --tags`).
- Keep the ZIP for that version archived locally — Chrome doesn't let you re-download a submitted build.
- For updates, bump `version` in both `package.json` and `manifest.config.ts`, rebuild, re-zip, upload as a new version under the same item. Chrome auto-rolls out to installed users.

## Appendix — what's NOT in the extension

For transparency with reviewers (and future-you):

- The MV3 background service worker exists only to validate and broker
  allow-listed wallet RPC requests; it performs no polling, analytics, or
  persistent background processing.
- No cookies. `chrome.storage.local` is used for favorites and the popup data cache only — both stay on the device.
- No alarms, tabs, or webRequest permission. `scripting` is used only for the validated wallet request path described above.
- No external fonts, no hosted CSS.
- No fingerprinting or device-identifier reads.
