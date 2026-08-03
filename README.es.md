# Morpho Enhancements

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Русский](README.ru.md) · **Español**

Una extensión de Chrome que rellena cuatro huecos en [app.morpho.org](https://app.morpho.org):

1. **Supply / Withdraw a nivel de mercado** — en cualquier página de mercado de Morpho Blue la UI oficial solo ofrece Borrow. Esta extensión inyecta una pestaña **Lend** junto a Borrow que deposita el activo de préstamo directamente en el mercado (la misma llamada `Morpho.supply()` que usan internamente los vaults de MetaMorpho) y luego permite retirar — así puedes ganar intereses específicos del mercado sin pasar por un MetaMorpho vault.

2. **Visibilidad en el dashboard** — el dashboard oficial lista depósitos en vaults y posiciones de préstamo, pero no los supplies directos al mercado. La extensión añade una tarjeta **Market Lending** con las posiciones directas en las 10 cadenas que soporta la extensión, valor en USD, APY y acceso al mercado.

3. **Favoritos en `/variable` y `/vaults`** — marca con una estrella cualquier fila y activa el chip **Favorites only** para filtrar la lista a los pocos que te importan. Los favoritos se guardan en el navegador y se sincronizan entre pestañas.

4. **Popup en la barra de herramientas** — haz clic en el icono de la extensión para una vista rápida: la pestaña *Prime* lista 19 mercados blue-chip seleccionados a mano en Mainnet / Base / Arbitrum / OP con supply APY, TVL, utilización y LLTV en vivo; la pestaña *Favorites* muestra todos tus mercados y vaults favoritos (V1 y V2 de MetaMorpho con soporte). Ordena por APY o TVL, y haz clic en cualquier fila para saltar a la página correspondiente en app.morpho.org.

<p align="center">
  <img src="docs/screenshots/market-lend-light.png" width="360" alt="Página de mercado — pestaña Lend (claro)">
  <img src="docs/screenshots/market-lend-dark.png" width="360" alt="Página de mercado — pestaña Lend (oscuro)">
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-card-light.png" width="720" alt="Dashboard — tarjeta Market Lending (claro)">
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-card-dark.png" width="720" alt="Dashboard — tarjeta Market Lending (oscuro)">
</p>

<p align="center">
  <img src="docs/screenshots/favorites-markets-light.png" width="720" alt="Lista de Markets — estrellas en cada fila, chip Favorites (claro)">
</p>

<p align="center">
  <img src="docs/screenshots/favorites-markets-filtered-light.png" width="720" alt="Lista de Markets filtrada a favoritos (claro)">
</p>

<p align="center">
  <img src="docs/screenshots/popup-prime-light.png" width="320" alt="Popup en la barra — pestaña Prime (claro)">
  <img src="docs/screenshots/popup-favorites-light.png" width="320" alt="Popup en la barra — pestaña Favorites (claro)">
</p>

<p align="center">
  <img src="docs/screenshots/popup-prime-dark.png" width="320" alt="Popup en la barra — pestaña Prime (oscuro)">
  <img src="docs/screenshots/popup-favorites-dark.png" width="320" alt="Popup en la barra — pestaña Favorites (oscuro)">
</p>

> Las capturas usan datos de posición simulados. Balances reales, direcciones y hashes de mercado nunca forman parte de las imágenes publicadas.

## Funcionalidades

- **Pestañas Borrow | Lend** en el panel de mercado. Al pulsar Lend se sustituye el formulario nativo por una UI de supply / withdraw con el mismo lenguaje visual de Morpho, tanto en modo claro como oscuro.
- **Wrap automático ETH / WETH** — cuando el activo de préstamo es wrapped-native puedes pagar con la moneda nativa. Supply requiere 1–4 transacciones según wrap, approve y el reset de allowance de tokens como USDT; retirar como moneda nativa requiere hasta 2.
- **Dashboard multi-cadena** — la tarjeta Market Lending consulta las 10 cadenas soportadas por la extensión en una query multi-cadena (con paginación después de 100 posiciones). La fuente de verdad es [src/lib/chains.ts](src/lib/chains.ts).
- **Favoritos en páginas de lista** — marca con estrella mercados y vaults en `/variable` y `/vaults`, y luego filtra la tabla a tus favoritos con un chip de un clic. Se guarda solo en `chrome.storage.local` (sin servidor ni tracking); se sincroniza entre pestañas y con el popup vía `chrome.storage.onChanged`.
- **Popup de la barra con dos pestañas** — *Prime* (19 mercados blue-chip seleccionados a mano en Mainnet / Base / Arbitrum / OP) y *Favorites* (tus mercados y vaults marcados; V1 y V2 de MetaMorpho con un pequeño chip `V1`/`V2` en la fila). Caché stale-while-revalidate: 5 min en memoria + persistencia en `chrome.storage.local`, así reabrir el popup pinta los últimos datos al instante mientras se hace fetch fresco en background. Ordena por APY ↓ o TVL ↓.
- **Reutiliza la injected wallet de la página** — sin otra sesión WalletConnect. Si el sitio aún no está conectado, la wallet puede pedir acceso a la cuenta. Compatible con EIP-6963 y `window.ethereum` legacy, incluidos MetaMask, Rabby, Frame y Coinbase Wallet.
- **Soporte ERC-20 no estándar** — USDT (y otros tokens cuyo `approve` no devuelve datos) funcionan de fábrica; el ABI de approve se declara sin outputs, así la simulación de viem no falla con `0x`.
- **Errores humanizados** — rechazar una firma vuelve silenciosamente a idle. Saldo insuficiente, cadena equivocada, nonce atascado y motivos de revert se convierten en frases cortas en lugar de un volcado de 2 KB de viem.
- **Sin analytics, sin telemetría, sin backend propio** — llamadas directas al contrato Morpho Blue por RPCs públicas, más la API pública de Morpho para APY/USD.

## Cómo funciona

- **Contratos** — las lecturas de mercado y supply/withdraw pasan por el singleton Morpho Blue `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` en cada cadena soportada. `idToMarketParams(id)` resuelve parámetros, `supply(...)` deposita y `position(...)` + `market(...)` alimentan el balance. Approve y wrap/unwrap llaman directamente al loan token o al native-wrapper contract.
- **Mediación de wallet** — las solicitudes pasan del content script aislado al service worker de la extensión. El worker valida el origen y el método RPC antes de ejecutar una solicitud limitada EIP-6963 / `window.ethereum` en `MAIN` world. Los scripts de la página no pueden invocar el wallet mediante `window.postMessage`; la extensión nunca maneja claves.
- **Datos** — GraphQL ligero contra `https://api.morpho.org/graphql` para APY y USD. La matemática shares-to-assets también está portada localmente en `sharesMath.ts` para lecturas directas on-chain.
- **UI** — los widgets independientes del Dashboard usan React 19 + Shadow DOM; el formulario Lend del mercado se monta deliberadamente en light DOM para heredar los design tokens y utility classes nativos de Borrow. La navegación SPA se detecta parcheando `history.pushState` / `replaceState` y un `MutationObserver` con throttling que ignora cambios DOM por animaciones.

## Cadenas soportadas

| slug (URL) | chainId | nativo / wrapped-native |
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

Los slugs de URL provienen de `app.morpho.org/sitemap.xml`; los chain IDs se contrastan con la lista oficial de [redes compatibles con Morpho API](https://docs.morpho.org/developers/api/get-started/#supported-networks). Las direcciones de contratos wrapped-native se mantienen en [`src/lib/chains.ts`](src/lib/chains.ts) y se verifican contra el deployment del native wrapper de cada red.

La extensión integra actualmente 10 redes de la lista de Morpho API. Robinhood Chain, Stable y Tempo aparecen en la API, pero aún no están soportadas por la extensión.

## Instalación

### Desde GitHub Releases (instalación manual)

Cada tag `v*` dispara una build de GitHub Actions que adjunta el ZIP a la [página de Releases](../../releases). Para instalar:

1. Descarga `morpho-enhancements-<version>-unpacked.zip` desde el último release
2. Descomprímelo en una ubicación estable (p. ej. `~/extensions/morpho-enhancements/`)
3. Abre `chrome://extensions`
4. Activa **Modo de desarrollador** (arriba a la derecha)
5. Haz clic en **Cargar descomprimida** → elige la carpeta descomprimida

Chrome mostrará el aviso de "extensión en modo desarrollador" — es normal para una instalación local. El artefacto de release tiene la misma funcionalidad que la build de la tienda, pero se actualiza manualmente.

### Desde el código fuente (dev)

Requiere Node.js 20 o posterior y pnpm (el lockfile usa el formato pnpm 9).

```bash
pnpm install
pnpm build
# Chrome → chrome://extensions → Modo de desarrollador → Cargar descomprimida → selecciona ./dist
```

Iterar con `pnpm dev` (Vite + crxjs HMR).

## Tests

```bash
# Release gate completo: lógica, build, live DOM probes, extension E2E,
# capturas y ZIP para Chrome Web Store
pnpm test:release

# Sonda DOM contra el sitio real (captura anclas y un layout JSON de muestra)
pnpm probe

# End-to-end — lanza Chromium con la extensión compilada. Cubre: pestaña Lend,
# montaje del dashboard, legibilidad en modo oscuro, aislamiento de wallet, favoritos
# (estrella + filtro) y popup de la barra (pestañas, orden, V1/V2 vault, caché)
pnpm test:e2e
```

Regenerar las capturas del README (las respuestas GraphQL están mockeadas, no se fugan balances reales):

```bash
pnpm exec playwright test tests/e2e/screenshots.spec.ts
```

## Estructura del proyecto

```
src/
├── background.ts             # Servicio wallet RPC validado y con allow-list
├── manifest.config.ts        # Declaración del manifest MV3
├── content/
│   ├── main.ts               # ISOLATED world — watcher de rutas SPA + dispatcher de montaje
│   ├── mount.ts              # Host Shadow DOM + React root + sincronización de tema
│   ├── router.ts             # pushState/replaceState → evento locationchange
│   ├── marketIntegration.ts  # Inyección de pestañas Borrow | Lend en el panel de mercado
│   └── listsIntegration.ts   # Estrella de favoritos + filter chip en /variable y /vaults
├── lib/
│   ├── morpho.ts             # viem public client + helpers del contrato Morpho
│   ├── morphoAbi.ts          # ABIs IMorpho + ERC20 + WETH9
│   ├── sharesMath.ts         # Port de SharesMathLib (virtual shares/assets)
│   ├── chains.ts             # Slug ↔ chain ID, wrapped-native, fallback de RPCs
│   ├── url.ts                # Matcher de rutas (market / dashboard / list / other)
│   ├── favorites.ts          # Store de favoritos en chrome.storage.local + sync entre pestañas
│   ├── graphql.ts            # Cliente de Morpho API (mercados, vaults V1/V2, batch + caché SWR)
│   ├── pageProvider.ts       # Cliente RPC del service worker + adaptador WalletClient de viem
│   └── walletRpcPolicy.ts    # Validación de sender, método y parámetros de wallet RPC
├── ui/
│   ├── MarketLendForm.tsx    # Formulario Supply / Withdraw de la página de mercado (con toggle de wrap)
│   ├── DashboardSupplyCard.tsx
│   ├── errorMessage.ts       # Error de viem → mensaje corto amigable
│   ├── format.ts             # Formateadores bigint / USD / porcentaje
│   └── styles.css            # Tokens de tema con alcance Shadow-DOM
├── popup/
│   ├── index.html            # Entrada del popup MV3
│   ├── main.tsx              # React root
│   ├── Popup.tsx             # Pestañas (Prime / Favorites), barra de orden, filas, refresh
│   ├── TokenIcon.tsx         # Loader de iconos de token (CDN Morpho → letra fallback)
│   └── popup.css             # Banner de marca, pestañas, filas, claro + oscuro
├── data/
│   └── curatedMarkets.ts     # Lista Prime curada (19 mercados, mantenida a mano)
public/
├── icons/                    # Generados por scripts/make-logo.py (16/32/48/128)
└── logo.svg                  # Vector maestro (mariposa Morpho + insignia de enhancement)
scripts/
├── make-logo.py              # Regenera los iconos desde morpho-base.svg
└── morpho-base.svg           # Mariposa Morpho oficial (fuente)
tests/
├── unit/                     # Tests de rutas, matemáticas, cadenas, RPC policy y GraphQL
├── probe/                    # Live DOM compatibility probes contra app.morpho.org
└── e2e/
    ├── extensionStorage.ts   # Helper de chrome.storage en contexto de extensión
    ├── extension.spec.ts     # Lend, montaje del dashboard, modo oscuro, aislamiento de wallet
    ├── favorites.spec.ts     # Estrella + filtro + persistencia en extension storage
    ├── popup.spec.ts         # Popup de la barra — pestañas, orden, V1/V2 vault, caché, refresh
    └── screenshots.spec.ts   # Capturas de README / store (datos mockeados)
```

## Seguridad

- El estado se lee mediante 1–4 RPCs públicas configuradas por cadena; viem usa fallback donde hay varios endpoints. Las escrituras pasan por la wallet del usuario — la extensión nunca guarda ni pide claves privadas.
- Las escrituras Morpho, approve y unwrap se simulan antes del prompt; el native wrap se envía directamente. Cada receipt debe confirmar éxito antes de continuar.
- El full-withdraw usa shares (no assets) para evitar reverts de precisión por la acumulación de intereses; el partial-withdraw usa assets con tolerancia del 0,01%.
- Host permissions limitados a `https://app.morpho.org/*`. `storage` guarda favoritos y caché localmente; `scripting` solo ejecuta wallet RPC con sender validado y métodos allow-listed. Los datos solo salen hacia las RPC configuradas, `api.morpho.org` y la CDN de logos de Morpho.

## Limitaciones conocidas

- **Wrap + supply en una sola tx** todavía no está implementado. El Bundler / GeneralAdapter de Morpho permitiría un multicall; hoy son 1–4 transacciones según el estado de wrap y allowance.
- **Sesiones solo por WalletConnect** que no expongan un provider EIP-1193 inyectado en la página no son detectadas por el puente.
- **Tamaño del bundle** la build actual de v0.4.0 contiene unos 555 KiB de JavaScript sin comprimir (568.401 bytes), principalmente en los chunks de content/popup con viem. El tamaño exacto cambia entre builds.

## Publicación

El paso a paso para enviar al Chrome Web Store (estructura del zip, copy del listing, declaraciones de privacidad, consejos para la revisión) está en [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## Licencia

MIT — ver [LICENSE](LICENSE).

Este proyecto no está afiliado a Morpho Labs. "Morpho" y la mariposa de Morpho son marcas de sus respectivos dueños; el archivo base del logo (`scripts/morpho-base.svg`) lo sirve la CDN pública de Morpho.
