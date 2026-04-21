# Contributing

Thanks for considering a patch.

## Ground rules

- **Scope discipline.** This extension is a targeted, on-one-host layer over Morpho. Feature requests that would expand the scope ("make it work on Aave", "add a swap widget") are probably a different project.
- **No telemetry, no remote scripts, no extra host permissions** — any PR that introduces these will be rejected on principle, not just on review.
- **Match Morpho's look.** When injecting UI, prefer Morpho's own Tailwind utility classes over our own styles so the extension feels native in both themes.
- **Keep the bundle honest.** If you add a dependency, mention why it couldn't be a small helper.

## Dev loop

```bash
pnpm install
pnpm dev             # Vite + crxjs HMR — Chrome reloads the extension automatically
pnpm build           # Production build to dist/
pnpm typecheck       # tsc --noEmit
pnpm probe           # Scrape current DOM anchors from the live Morpho site
pnpm test:e2e        # Playwright: 4 E2E tests including a dark-mode legibility check
```

Reload the built extension in Chrome: `chrome://extensions` → toggle off + on.

## Before you open a PR

1. **Tests pass**: `pnpm test:e2e` (all 4 green). If you added UI, add or update a spec in `tests/e2e/`.
2. **Typecheck passes**: `pnpm typecheck`.
3. **Screenshots re-generated if UI changed**: `pnpm exec playwright test tests/e2e/screenshots.spec.ts`. Commit only if the visual change is intentional.
4. **Manifest version bumped** if the change is user-visible (both `package.json` and `src/manifest.config.ts`).
5. **No real wallet data in commits** — check screenshots, test fixtures, and debug logs.

## Areas that would actually help

- **One-tx wrap-and-supply via Morpho's Bundler** — see the "Publishing" note in the README about the 2–3 sig wrap flow. Replacing it with a Bundler multicall is a well-scoped chunk.
- **Permit2 / EIP-2612 approvals** for tokens that support them, so approve + supply collapses to one signature.
- **Position card chain badge** — on the dashboard, show a small chain logo on each market card so multichain is visually legible at a glance.
- **Bundle splitting** — viem dominates the bundle. Dynamic-importing chain-specific code paths would cut initial load materially.

## Style

- TypeScript strict mode. `any` is a red flag.
- Formatting: the project isn't prettier-locked; mirror the style of the file you're editing.
- Comments should explain *why*, not *what*. A function's name + types should tell you what; reach for a comment when there's a non-obvious reason.
- For UI strings, prefer short and direct. "Supply USDT" beats "Start a new supply transaction for USDT".

## Security issues

Please don't file a public issue for anything that could affect users' funds. Email the maintainers first (contact info in the GitHub org profile) so there's a chance to ship a fix before the issue goes public.
