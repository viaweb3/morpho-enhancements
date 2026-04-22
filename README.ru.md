# Morpho Enhancements

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Русский** · [Español](README.es.md)

Расширение Chrome, заполняющее три пробела в [app.morpho.org](https://app.morpho.org):

1. **Supply / Withdraw на уровне рынка** — на страницах рынков Morpho Blue официальный UI предлагает только Borrow. Расширение добавляет вкладку **Lend** рядом с Borrow, которая кладёт заёмный актив напрямую в рынок (тот же вызов `Morpho.supply()`, что используют MetaMorpho vault-ы), а позже позволяет вывести средства — так можно получать проценты по конкретному рынку без посредничества vault-а.

2. **Видимость на дашборде** — штатный дашборд показывает депозиты в vault-ы и заёмные позиции, но не прямые поставки в рынки. Расширение добавляет карточку **Market Lending**, которая показывает все рынки, где пользователь является прямым кредитором, по всем поддерживаемым Morpho сетям, с USD-стоимостью, APY и ссылкой на страницу рынка.

3. **Избранное на `/markets` и `/vaults`** — звёздочка у любой строки добавляет рынок/vault в закладки, а чип **Favorites only** в нижнем левом углу фильтрует список до пары тех, что вам важны. Хранится в браузере и синхронизируется между вкладками.

<p align="center">
  <img src="docs/screenshots/market-lend-light.png" width="360" alt="Страница рынка — вкладка Lend (light)">
  <img src="docs/screenshots/market-lend-dark.png" width="360" alt="Страница рынка — вкладка Lend (dark)">
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-card-light.png" width="720" alt="Dashboard — карточка Market Lending (light)">
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-card-dark.png" width="720" alt="Dashboard — карточка Market Lending (dark)">
</p>

<p align="center">
  <img src="docs/screenshots/favorites-markets-light.png" width="720" alt="Список Markets — звёзды у строк, чип Favorites (light)">
</p>

<p align="center">
  <img src="docs/screenshots/favorites-markets-filtered-light.png" width="720" alt="Список Markets — только избранное (light)">
</p>

> Скриншоты используют мок-данные позиций. Реальные балансы, адреса и хеши рынков никогда не попадают в публикуемые изображения.

## Возможности

- **Вкладки Borrow | Lend** на панели рынка. Клик по Lend заменяет штатную форму на UI supply / withdraw, совпадающий со стилем Morpho в светлой и тёмной темах.
- **Автоматический wrap ETH / WETH** — если заёмный актив является wrapped-native токеном сети, появляется переключатель, позволяющий платить нативной валютой (POL на Polygon, MON на Monad, HYPE на HyperEVM и т. д.). Расширение автоматически делает wrap перед supply и unwrap после withdraw. Всего две подписи, без отдельного UX-прохода для wrap.
- **Dashboard по 10 сетям** — карточка Market Lending одним запросом охватывает Ethereum, Base, Arbitrum, Optimism, Polygon, Unichain, Monad, World Chain, Katana, HyperEVM.
- **Избранное на страницах списков** — звезда у рынков и vault-ов в `/markets` и `/vaults`, фильтрация одним кликом. Хранение только в `localStorage` (без сервера и трекинга), работает офлайн, синхронизируется между вкладками.
- **Использует уже подключенный кошелёк** — без повторного connect-флоу. Поддерживает MetaMask, Rabby, Frame, Coinbase Wallet и любой EIP-6963-совместимый провайдер.
- **Нестандартные ERC-20** — USDT (и другие токены, у которых `approve` не возвращает данных) работают из коробки; approve ABI объявлен без outputs, поэтому симуляция viem не падает на `0x`.
- **Человеческие ошибки** — отклонение подписи тихо возвращает в idle. Недостаток баланса, не та сеть, застрявший nonce и причины revert превращаются в короткие фразы вместо 2 КБ viem-дампа.
- **Без аналитики, телеметрии и бэкенда** — прямые вызовы контракта Morpho Blue через публичные RPC, плюс blue-api Morpho для APY/USD.

## Как это работает

- **Контракты** — все чтения/записи идут через синглтон Morpho Blue по адресу `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` (детерминированный CREATE2 на всех поддерживаемых сетях). `idToMarketParams(id)` разрешает id рынка из URL в параметры on-chain; `supply(params, assets, 0, onBehalf, "0x")` обрабатывает депозит; `position(id, user)` + `market(id)` питают расчёт баланса.
- **Мост кошелька** — content script в `world: "MAIN"` реализует обнаружение EIP-6963 (+ fallback на `window.ethereum`) и проксирует запросы EIP-1193 через `window.postMessage` к изолированному content script. Поверх строится viem `WalletClient`; ключи не удерживаются.
- **Данные** — лёгкий GraphQL к `https://blue-api.morpho.org/graphql` для APY и USD. Математика shares↔assets также портирована локально в `sharesMath.ts` для прямых чтений on-chain.
- **UI** — React 19, смонтированный внутри Shadow DOM, чтобы стили расширения не протекали на страницу Morpho и обратно. SPA-навигация ловится патчем `history.pushState` / `replaceState` и тротлированным `MutationObserver`-ом, игнорирующим DOM-шум от анимаций.

## Поддерживаемые сети

| slug (URL) | chainId | нативный / wrapped-native |
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

Slug-и берутся из `app.morpho.org/sitemap.xml`; адреса — из [`morpho-blue-api-metadata`](https://github.com/morpho-org/morpho-blue-api-metadata).

## Установка

### Из GitHub Releases (рекомендуется, пока идёт модерация в Chrome Web Store)

Каждый тег `v*` запускает сборку GitHub Actions, которая прикрепляет ZIP к [странице Releases](../../releases). Чтобы установить:

1. Скачайте `morpho-enhancements-<version>-unpacked.zip` из последнего релиза
2. Распакуйте в стабильное место (например `~/extensions/morpho-enhancements/`)
3. Откройте `chrome://extensions`
4. Включите **Режим разработчика** (вверху справа)
5. Нажмите **Загрузить распакованное расширение** → выберите распакованную папку

Chrome покажет предупреждение о «расширении в режиме разработчика» — это ожидаемо для любых локально установленных расширений. После прохождения модерации в Chrome Web Store установка станет в один клик, но она занимает дни; функционально это тот же путь.

### Из исходников (dev)

```bash
pnpm install
pnpm build
# Chrome → chrome://extensions → включить Режим разработчика → Загрузить распакованное → выбрать ./dist
```

Для разработки — `pnpm dev` (Vite + crxjs HMR).

## Тесты

```bash
# DOM-проба по живому сайту (собирает якоря и пример layout-JSON)
pnpm probe

# End-to-end — запускает Chromium со собранным расширением, проверяет вкладку Lend,
# монтирование dashboard, читаемость в тёмной теме и провайдерный мост
pnpm test:e2e
```

Регенерация скриншотов README (GraphQL-ответы мокируются, реальные балансы не утекают):

```bash
pnpm exec playwright test tests/e2e/screenshots.spec.ts
```

## Структура проекта

```
src/
├── manifest.config.ts        # Декларация MV3 manifest
├── content/
│   ├── main.ts               # ISOLATED world — наблюдение за SPA-маршрутами + диспетчер монтажа
│   ├── mount.ts              # Shadow DOM host + React root + синхронизация темы
│   ├── router.ts             # pushState/replaceState → событие locationchange
│   ├── marketIntegration.ts  # Инъекция вкладок Borrow | Lend на панели рынка
│   └── listsIntegration.ts   # Звёзды избранного + filter chip на /markets и /vaults
├── lib/
│   ├── morpho.ts             # viem public client + хелперы контракта Morpho
│   ├── morphoAbi.ts          # ABI IMorpho + ERC20 + WETH9
│   ├── sharesMath.ts         # Порт SharesMathLib (virtual shares/assets)
│   ├── chains.ts             # Slug ↔ chain ID, wrapped-native, список RPC fallback
│   ├── url.ts                # Матчер маршрутов (market / dashboard / list / other)
│   ├── favorites.ts          # Хранилище избранного на базе localStorage
│   ├── graphql.ts            # Клиент blue-api
│   └── pageProvider.ts       # Клиент моста + адаптер viem WalletClient
├── ui/
│   ├── MarketLendForm.tsx    # Форма Supply / Withdraw на странице рынка (с wrap-тумблером)
│   ├── DashboardSupplyCard.tsx
│   ├── errorMessage.ts       # viem-ошибка → короткое сообщение
│   ├── format.ts             # Форматтеры bigint / USD / процентов
│   └── styles.css            # Токены темы в рамках Shadow DOM
public/
├── icons/                    # Генерируется scripts/make-logo.py (16/32/48/128)
├── logo.svg                  # Мастер-вектор (бабочка Morpho + enhancement-значок)
└── injected/
    └── provider-bridge.js    # Чистый JS MAIN-world мост (не бандлится с приложением)
scripts/
├── make-logo.py              # Регенерация иконок из morpho-base.svg
└── morpho-base.svg           # Официальная бабочка Morpho (источник)
tests/
├── probe/                    # DOM-скрейпы против app.morpho.org
└── e2e/
    ├── extension.spec.ts     # Функциональный E2E
    └── screenshots.spec.ts   # Скриншоты README / листинга (моковые данные)
```

## Безопасность

- Состояние контракта читается через публичные RPC (fallback по 4 провайдера на сеть в viem). Записи идут через кошелёк пользователя — расширение не удерживает и не запрашивает приватные ключи.
- Все записи симулируются через `simulateContract` перед `writeContract`, чтобы revert-ы проявлялись читаемой ошибкой до prompt-а кошелька.
- Полный withdraw использует shares (а не assets), чтобы избежать revert-ов из-за точности при накоплении процентов; частичный withdraw использует assets с допуском 0.01%.
- Host permissions ограничены `https://app.morpho.org/*`. Никакие данные не отправляются кому-либо, кроме настроенных пользователем RPC, `blue-api.morpho.org` и CDN Morpho с логотипами токенов.

## Известные ограничения

- **Wrap-and-supply за одну транзакцию** пока не реализован. Bundler / GeneralAdapter от Morpho позволяют упаковать wrap + approve + supply в один multicall; сейчас это 2–3 подписи.
- **Сессии только через WalletConnect**, в которых на странице не выставлен injected EIP-1193 провайдер, мост не подхватывает.
- **Размер бандла** около 530 КБ до gzip, основное — viem. В следующем релизе будет динамический import путей чейна/контрактов viem.

## Публикация

Пошаговая инструкция по отправке в Chrome Web Store (структура zip, текст листинга, privacy-декларации, советы по модерации) — в [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## Лицензия

MIT — см. [LICENSE](LICENSE).

Проект не аффилирован с Morpho Labs. «Morpho» и знак с бабочкой Morpho являются товарными знаками соответствующих владельцев; базовый файл логотипа (`scripts/morpho-base.svg`) раздаётся публичным CDN Morpho.
