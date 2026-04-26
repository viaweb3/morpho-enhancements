# Morpho Enhancements

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Русский](README.ru.md) · **Español**

Una extensión de Chrome que rellena cuatro huecos en [app.morpho.org](https://app.morpho.org):

1. **Supply / Withdraw a nivel de mercado** — en cualquier página de mercado de Morpho Blue la UI oficial solo ofrece Borrow. Esta extensión inyecta una pestaña **Lend** junto a Borrow que deposita el activo de préstamo directamente en el mercado (la misma llamada `Morpho.supply()` que usan internamente los vaults de MetaMorpho) y luego permite retirar — así puedes ganar intereses específicos del mercado sin pasar por un MetaMorpho vault.

2. **Visibilidad en el dashboard** — el dashboard oficial lista depósitos en vaults y posiciones de préstamo, pero no los supplies directos al mercado. La extensión añade una tarjeta **Market Lending** que muestra cada mercado donde el usuario presta directamente, en todas las cadenas que soporta Morpho, con valor en USD, APY y acceso directo a la página del mercado.

3. **Favoritos en `/markets` y `/vaults`** — marca con una estrella cualquier fila y activa el chip **Favorites only** para filtrar la lista a los pocos que te importan. Los favoritos se guardan en el navegador y se sincronizan entre pestañas.

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
- **Wrap automático ETH / WETH** — cuando el activo de préstamo es el token wrapped-native de la cadena, un toggle te deja pagar con la moneda nativa (POL en Polygon, MON en Monad, HYPE en HyperEVM, etc.); la extensión hace el wrap antes del supply y el unwrap tras el withdraw. Dos firmas en total, sin pasos extra de UX para el wrap.
- **Dashboard multi-cadena** — la tarjeta Market Lending consulta en un único request todas las cadenas soportadas por Morpho. La lista vigente se mantiene en [src/services/chain/morphoSupportedChains.ts](src/services/chain/morphoSupportedChains.ts).
- **Favoritos en páginas de lista** — marca con estrella mercados y vaults en `/markets` y `/vaults`, y luego filtra la tabla a tus favoritos con un chip de un clic. Se guarda solo en `chrome.storage.local` (sin servidor ni tracking); se sincroniza entre pestañas y con el popup vía `chrome.storage.onChanged`.
- **Popup de la barra con dos pestañas** — *Prime* (19 mercados blue-chip seleccionados a mano en Mainnet / Base / Arbitrum / OP) y *Favorites* (tus mercados y vaults marcados; V1 y V2 de MetaMorpho con un pequeño chip `V1`/`V2` en la fila). Caché stale-while-revalidate: 5 min en memoria + persistencia en `chrome.storage.local`, así reabrir el popup pinta los últimos datos al instante mientras se hace fetch fresco en background. Ordena por APY ↓ o TVL ↓.
- **Reutiliza la wallet de la página** — sin segundo flujo de connect. Funciona con MetaMask, Rabby, Frame, Coinbase Wallet y cualquier inyección compatible con EIP-6963.
- **Soporte ERC-20 no estándar** — USDT (y otros tokens cuyo `approve` no devuelve datos) funcionan de fábrica; el ABI de approve se declara sin outputs, así la simulación de viem no falla con `0x`.
- **Errores humanizados** — rechazar una firma vuelve silenciosamente a idle. Saldo insuficiente, cadena equivocada, nonce atascado y motivos de revert se convierten en frases cortas en lugar de un volcado de 2 KB de viem.
- **Sin analytics, sin telemetría, sin backend propio** — llamadas directas al contrato Morpho Blue por RPCs públicas, más el blue-api de Morpho para APY/USD.

## Cómo funciona

- **Contratos** — todas las lecturas/escrituras pasan por el singleton Morpho Blue en `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` (CREATE2 determinista en todas las cadenas soportadas). `idToMarketParams(id)` resuelve el id de mercado de la URL a parámetros on-chain; `supply(params, assets, 0, onBehalf, "0x")` gestiona el depósito; `position(id, user)` + `market(id)` alimentan el cálculo de balance.
- **Puente de wallet** — un content script `world: "MAIN"` implementa descubrimiento EIP-6963 (con fallback al clásico `window.ethereum`) y redirige peticiones EIP-1193 vía `window.postMessage` al content script aislado. La UI construye por encima un `WalletClient` de viem y nunca maneja claves.
- **Datos** — GraphQL ligero contra `https://blue-api.morpho.org/graphql` para APY y USD. La matemática shares-to-assets también está portada localmente en `sharesMath.ts` para lecturas directas on-chain.
- **UI** — React 19 montado dentro de un Shadow DOM para que los estilos de la extensión no se filtren a la página de Morpho ni al revés. La navegación SPA se detecta parcheando `history.pushState` / `replaceState` y un `MutationObserver` con throttling que ignora cambios DOM por animaciones.

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

Los slugs provienen de `app.morpho.org/sitemap.xml`; las direcciones de [`morpho-blue-api-metadata`](https://github.com/morpho-org/morpho-blue-api-metadata).

## Instalación

### Desde GitHub Releases (recomendado mientras está pendiente la revisión de Chrome Web Store)

Cada tag `v*` dispara una build de GitHub Actions que adjunta el ZIP a la [página de Releases](../../releases). Para instalar:

1. Descarga `morpho-enhancements-<version>-unpacked.zip` desde el último release
2. Descomprímelo en una ubicación estable (p. ej. `~/extensions/morpho-enhancements/`)
3. Abre `chrome://extensions`
4. Activa **Modo de desarrollador** (arriba a la derecha)
5. Haz clic en **Cargar descomprimida** → elige la carpeta descomprimida

Chrome mostrará el aviso de "extensión en modo desarrollador" — es el comportamiento normal para cualquier extensión instalada localmente. Cuando pase la revisión del Chrome Web Store la instalación será de un clic, pero tarda días; funcionalmente esta ruta es idéntica.

### Desde el código fuente (dev)

```bash
pnpm install
pnpm build
# Chrome → chrome://extensions → Modo de desarrollador → Cargar descomprimida → selecciona ./dist
```

Iterar con `pnpm dev` (Vite + crxjs HMR).

## Tests

```bash
# Sonda DOM contra el sitio real (captura anclas y un layout JSON de muestra)
pnpm probe

# End-to-end — lanza Chromium con la extensión compilada. Cubre: pestaña Lend,
# montaje del dashboard, legibilidad en modo oscuro, puente de provider, favoritos
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
├── manifest.config.ts        # Declaración del manifest MV3
├── content/
│   ├── main.ts               # ISOLATED world — watcher de rutas SPA + dispatcher de montaje
│   ├── mount.ts              # Host Shadow DOM + React root + sincronización de tema
│   ├── router.ts             # pushState/replaceState → evento locationchange
│   ├── marketIntegration.ts  # Inyección de pestañas Borrow | Lend en el panel de mercado
│   └── listsIntegration.ts   # Estrella de favoritos + filter chip en /markets y /vaults
├── lib/
│   ├── morpho.ts             # viem public client + helpers del contrato Morpho
│   ├── morphoAbi.ts          # ABIs IMorpho + ERC20 + WETH9
│   ├── sharesMath.ts         # Port de SharesMathLib (virtual shares/assets)
│   ├── chains.ts             # Slug ↔ chain ID, wrapped-native, fallback de RPCs
│   ├── url.ts                # Matcher de rutas (market / dashboard / list / other)
│   ├── favorites.ts          # Store de favoritos en chrome.storage.local + sync entre pestañas + bridge E2E
│   ├── graphql.ts            # Cliente de blue-api (mercados, vaults V1/V2, batch + caché SWR)
│   └── pageProvider.ts       # Cliente del puente + adaptador WalletClient de viem
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
├── logo.svg                  # Vector maestro (mariposa Morpho + insignia de enhancement)
└── injected/
    └── provider-bridge.js    # Puente MAIN-world en JS puro (no se bundle con el código de la app)
scripts/
├── make-logo.py              # Regenera los iconos desde morpho-base.svg
└── morpho-base.svg           # Mariposa Morpho oficial (fuente)
tests/
├── probe/                    # Scrapes de DOM contra app.morpho.org
└── e2e/
    ├── extension.spec.ts     # Lend, montaje del dashboard, modo oscuro, puente de provider
    ├── favorites.spec.ts     # Estrella + filtro + persistencia (vía bridge postMessage de test)
    ├── popup.spec.ts         # Popup de la barra — pestañas, orden, V1/V2 vault, caché, refresh
    └── screenshots.spec.ts   # Capturas de README / store (datos mockeados)
```

## Seguridad

- El estado del contrato se lee por RPCs públicas (fallback de viem por 4 proveedores por cadena). Las escrituras pasan por la wallet del usuario — la extensión nunca guarda ni pide claves privadas.
- Todas las escrituras se simulan vía `simulateContract` antes de `writeContract`, así los revert aparecen como errores legibles antes del prompt de la wallet.
- El full-withdraw usa shares (no assets) para evitar reverts de precisión por la acumulación de intereses; el partial-withdraw usa assets con tolerancia del 0,01%.
- Host permissions limitados a `https://app.morpho.org/*`. La única API de Chrome usada es `chrome.storage.local` (favoritos + caché de datos del popup); no se envían datos a ningún servicio salvo las RPC configuradas por el usuario, `blue-api.morpho.org` y la CDN de logos de Morpho (`cdn.morpho.org`).

## Limitaciones conocidas

- **Wrap + supply en una sola tx** todavía no está implementado. El Bundler / GeneralAdapter de Morpho permitiría unir wrap + approve + supply en un único multicall; la extensión los hace como 2–3 firmas separadas.
- **Sesiones solo por WalletConnect** que no expongan un provider EIP-1193 inyectado en la página no son detectadas por el puente.
- **Tamaño del bundle** ~530 KB antes de gzip, dominado por viem. Una próxima versión hará import dinámico de las rutas de cadena / contrato de viem.

## Publicación

El paso a paso para enviar al Chrome Web Store (estructura del zip, copy del listing, declaraciones de privacidad, consejos para la revisión) está en [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## Licencia

MIT — ver [LICENSE](LICENSE).

Este proyecto no está afiliado a Morpho Labs. "Morpho" y la mariposa de Morpho son marcas de sus respectivos dueños; el archivo base del logo (`scripts/morpho-base.svg`) lo sirve la CDN pública de Morpho.
