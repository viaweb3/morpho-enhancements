# Morpho Enhancements

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Русский** · [Español](README.es.md)

Расширение Chrome, заполняющее четыре пробела в [app.morpho.org](https://app.morpho.org):

1. **Supply / Withdraw на уровне рынка** — на страницах рынков Morpho Blue официальный UI предлагает только Borrow. Расширение добавляет вкладку **Lend** рядом с Borrow, которая кладёт заёмный актив напрямую в рынок (тот же вызов `Morpho.supply()`, что используют MetaMorpho vault-ы), а позже позволяет вывести средства — так можно получать проценты по конкретному рынку без посредничества vault-а.

2. **Видимость на дашборде** — штатный дашборд показывает депозиты в vault-ы и заёмные позиции, но не прямые поставки в рынки. Расширение добавляет карточку **Market Lending** с прямыми позициями в 10 поддерживаемых расширением сетях, USD-стоимостью, APY и ссылкой на рынок.

3. **Избранное на `/variable` и `/vaults`** — звёздочка у любой строки добавляет рынок/vault в закладки, а чип **Favorites only** в нижнем левом углу фильтрует список до пары тех, что вам важны. Хранится в браузере и синхронизируется между вкладками.

4. **Popup на панели инструментов** — клик по иконке расширения открывает быстрый просмотр: вкладка *Prime* перечисляет 19 отобранных вручную blue-chip рынков по Mainnet / Base / Arbitrum / OP с supply APY, TVL, утилизацией и LLTV; вкладка *Favorites* показывает все ваши избранные рынки и vault-ы (V1 и V2 MetaMorpho поддерживаются). Сортировка по APY или TVL, клик по строке открывает соответствующую страницу на app.morpho.org.

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

<p align="center">
  <img src="docs/screenshots/popup-prime-light.png" width="320" alt="Popup на панели — вкладка Prime (light)">
  <img src="docs/screenshots/popup-favorites-light.png" width="320" alt="Popup на панели — вкладка Favorites (light)">
</p>

<p align="center">
  <img src="docs/screenshots/popup-prime-dark.png" width="320" alt="Popup на панели — вкладка Prime (dark)">
  <img src="docs/screenshots/popup-favorites-dark.png" width="320" alt="Popup на панели — вкладка Favorites (dark)">
</p>

> Скриншоты используют мок-данные позиций. Реальные балансы, адреса и хеши рынков никогда не попадают в публикуемые изображения.

## Возможности

- **Вкладки Borrow | Lend** на панели рынка. Клик по Lend заменяет штатную форму на UI supply / withdraw, совпадающий со стилем Morpho в светлой и тёмной темах.
- **Автоматический wrap ETH / WETH** — при wrapped-native заёмном активе можно платить нативной валютой. Supply требует 1–4 wallet-транзакции в зависимости от wrap, approve и сброса allowance для токенов вроде USDT; withdraw в нативную валюту — до 2.
- **Мультисетевой Dashboard** — карточка Market Lending получает 10 поддерживаемых расширением сетей одним multi-chain API-запросом (с пагинацией после 100 позиций). Source of truth списка — [src/lib/chains.ts](src/lib/chains.ts).
- **Избранное на страницах списков** — звезда у рынков и vault-ов в `/variable` и `/vaults`, фильтрация одним кликом. Хранится только в `chrome.storage.local` (без сервера и трекинга), синхронизируется между вкладками и popup через `chrome.storage.onChanged`.
- **Popup на панели с двумя вкладками** — *Prime* (19 отобранных вручную blue-chip рынков по Mainnet / Base / Arbitrum / OP) и *Favorites* (избранные рынки и vault-ы; V1 и V2 MetaMorpho с маленьким чипом `V1`/`V2` в строке). Stale-while-revalidate кеш: 5 минут в памяти + персистентность в `chrome.storage.local`, поэтому повторное открытие popup сразу рисует последние данные, пока в фоне идёт свежий запрос. Сортировка по APY ↓ или TVL ↓.
- **Использует injected wallet страницы** — без отдельной WalletConnect-сессии. Если сайт ещё не подключён, кошелёк может запросить доступ к аккаунту. Совместимо с EIP-6963 и legacy `window.ethereum`, включая MetaMask, Rabby, Frame и Coinbase Wallet.
- **Нестандартные ERC-20** — USDT (и другие токены, у которых `approve` не возвращает данных) работают из коробки; approve ABI объявлен без outputs, поэтому симуляция viem не падает на `0x`.
- **Человеческие ошибки** — отклонение подписи тихо возвращает в idle. Недостаток баланса, не та сеть, застрявший nonce и причины revert превращаются в короткие фразы вместо 2 КБ viem-дампа.
- **Без аналитики, телеметрии и бэкенда** — прямые вызовы контракта Morpho Blue через публичные RPC, плюс публичный API Morpho для APY/USD.

## Как это работает

- **Контракты** — чтения рынка и supply/withdraw идут через Morpho Blue singleton `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` в каждой поддерживаемой сети. `idToMarketParams(id)` разрешает параметры, `supply(...)` вносит средства, а `position(...)` + `market(...)` дают данные для баланса. Approve и wrap/unwrap напрямую вызывают loan token или native-wrapper contract.
- **Посредник кошелька** — запросы идут из изолированного content script в service worker расширения. Worker проверяет отправителя и метод RPC, затем выполняет ограниченный запрос EIP-6963 / `window.ethereum` в `MAIN` world. Скрипты страницы не могут вызвать кошелёк через `window.postMessage`; ключи не удерживаются.
- **Данные** — лёгкий GraphQL к `https://api.morpho.org/graphql` для APY и USD. Математика shares↔assets также портирована локально в `sharesMath.ts` для прямых чтений on-chain.
- **UI** — отдельные Dashboard-виджеты используют React 19 + Shadow DOM; форма Lend на странице рынка намеренно монтируется в light DOM, чтобы наследовать нативные design tokens и utility classes формы Borrow. SPA-навигация отслеживается патчем `history.pushState` / `replaceState` и тротлированным `MutationObserver`, игнорирующим DOM-шум от анимаций.

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

URL slug-и берутся из `app.morpho.org/sitemap.xml`, а chain ID сверяются с официальным [списком поддерживаемых сетей Morpho API](https://docs.morpho.org/developers/api/get-started/#supported-networks). Адреса wrapped-native контрактов поддерживаются в [`src/lib/chains.ts`](src/lib/chains.ts) и проверяются по deployment-ам native wrapper каждой сети.

Сейчас расширение интегрирует 10 сетей из списка Morpho API. Robinhood Chain, Stable и Tempo перечислены API, но расширением пока не поддерживаются.

## Установка

### Из GitHub Releases (ручная установка)

Каждый тег `v*` запускает сборку GitHub Actions, которая прикрепляет ZIP к [странице Releases](../../releases). Чтобы установить:

1. Скачайте `morpho-enhancements-<version>-unpacked.zip` из последнего релиза
2. Распакуйте в стабильное место (например `~/extensions/morpho-enhancements/`)
3. Откройте `chrome://extensions`
4. Включите **Режим разработчика** (вверху справа)
5. Нажмите **Загрузить распакованное расширение** → выберите распакованную папку

Chrome покажет предупреждение о «расширении в режиме разработчика» — это нормально для локальной установки. Release-артефакт функционально совпадает со store build, но обновляется вручную.

### Из исходников (dev)

Требуются Node.js 20+ и pnpm (lockfile использует формат pnpm 9).

```bash
pnpm install
pnpm build
# Chrome → chrome://extensions → включить Режим разработчика → Загрузить распакованное → выбрать ./dist
```

Для разработки — `pnpm dev` (Vite + crxjs HMR).

## Тесты

```bash
# Полный release gate: логика, сборка, live DOM probes, extension E2E,
# скриншоты и ZIP для Chrome Web Store
pnpm test:release

# DOM-проба по живому сайту (собирает якоря и пример layout-JSON)
pnpm probe

# End-to-end — запускает Chromium со собранным расширением. Покрывает: вкладку Lend,
# монтирование dashboard, читаемость в тёмной теме, изоляция кошелька, избранное
# (звёзды + фильтр) и popup на панели (вкладки, сортировка, V1/V2 vault, кеш)
pnpm test:e2e
```

Регенерация скриншотов README (GraphQL-ответы мокируются, реальные балансы не утекают):

```bash
pnpm exec playwright test tests/e2e/screenshots.spec.ts
```

## Структура проекта

```
src/
├── background.ts             # Проверенный отправитель и allow-list wallet RPC
├── manifest.config.ts        # Декларация MV3 manifest
├── content/
│   ├── main.ts               # ISOLATED world — наблюдение за SPA-маршрутами + диспетчер монтажа
│   ├── mount.ts              # Shadow DOM host + React root + синхронизация темы
│   ├── router.ts             # pushState/replaceState → событие locationchange
│   ├── marketIntegration.ts  # Инъекция вкладок Borrow | Lend на панели рынка
│   └── listsIntegration.ts   # Звёзды избранного + filter chip на /variable и /vaults
├── lib/
│   ├── morpho.ts             # viem public client + хелперы контракта Morpho
│   ├── morphoAbi.ts          # ABI IMorpho + ERC20 + WETH9
│   ├── sharesMath.ts         # Порт SharesMathLib (virtual shares/assets)
│   ├── chains.ts             # Slug ↔ chain ID, wrapped-native, список RPC fallback
│   ├── url.ts                # Матчер маршрутов (market / dashboard / list / other)
│   ├── favorites.ts          # Хранилище избранного на chrome.storage.local + кросс-таб синк
│   ├── graphql.ts            # Клиент Morpho API (рынки, V1/V2 vault, batch + SWR кеш)
│   ├── pageProvider.ts       # Клиент service-worker RPC + адаптер viem WalletClient
│   └── walletRpcPolicy.ts    # Проверка sender, method и params wallet RPC
├── ui/
│   ├── MarketLendForm.tsx    # Форма Supply / Withdraw на странице рынка (с wrap-тумблером)
│   ├── DashboardSupplyCard.tsx
│   ├── errorMessage.ts       # viem-ошибка → короткое сообщение
│   ├── format.ts             # Форматтеры bigint / USD / процентов
│   └── styles.css            # Токены темы в рамках Shadow DOM
├── popup/
│   ├── index.html            # Точка входа MV3 popup на панели
│   ├── main.tsx              # React root
│   ├── Popup.tsx             # Вкладки (Prime / Favorites), сортировка, строки, refresh
│   ├── TokenIcon.tsx         # Загрузчик иконок токенов (Morpho CDN → буква)
│   └── popup.css             # Брендовый banner, вкладки, строки, light + dark
├── data/
│   └── curatedMarkets.ts     # Prime watch-list (19 рынков, ручная поддержка)
public/
├── icons/                    # Генерируется scripts/make-logo.py (16/32/48/128)
└── logo.svg                  # Мастер-вектор (бабочка Morpho + enhancement-значок)
scripts/
├── make-logo.py              # Регенерация иконок из morpho-base.svg
└── morpho-base.svg           # Официальная бабочка Morpho (источник)
tests/
├── unit/                     # Тесты маршрутов, математики, сетей, RPC policy и GraphQL
├── probe/                    # Live DOM compatibility probes против app.morpho.org
└── e2e/
    ├── extensionStorage.ts   # Хелпер chrome.storage в контексте расширения
    ├── extension.spec.ts     # Lend, dashboard mount, тёмная тема, изоляция кошелька
    ├── favorites.spec.ts     # Звёзды + фильтр + хранение extension storage
    ├── popup.spec.ts         # Popup на панели — вкладки, сортировка, V1/V2 vault, кеш, refresh
    └── screenshots.spec.ts   # Скриншоты README / листинга (моковые данные)
```

## Безопасность

- Состояние контракта читается через 1–4 настроенных public RPC на сеть; при нескольких endpoint используется viem fallback. Записи идут через кошелёк пользователя — расширение не удерживает и не запрашивает приватные ключи.
- Записи Morpho, approve и unwrap симулируются до prompt-а кошелька; native wrap отправляется напрямую. Перед следующим шагом проверяется успешный receipt каждой транзакции.
- Полный withdraw использует shares (а не assets), чтобы избежать revert-ов из-за точности при накоплении процентов; частичный withdraw использует assets с допуском 0.01%.
- Host permissions ограничены `https://app.morpho.org/*`. `storage` локально хранит избранное и кеш; `scripting` выполняет только wallet RPC с проверенным sender и allow-list методов. Данные уходят лишь в настроенные RPC, `api.morpho.org` и CDN логотипов Morpho.

## Известные ограничения

- **Wrap-and-supply за одну транзакцию** пока не реализован. Bundler / GeneralAdapter от Morpho позволяют один multicall; сейчас это 1–4 wallet-транзакции в зависимости от wrap и allowance.
- **Сессии только через WalletConnect**, в которых на странице не выставлен injected EIP-1193 провайдер, мост не подхватывает.
- **Размер бандла** текущей сборки v0.4.0 — около 555 KiB несжатого JavaScript (568 401 байт), в основном content/popup chunks с viem. Точный размер зависит от сборки.

## Публикация

Пошаговая инструкция по отправке в Chrome Web Store (структура zip, текст листинга, privacy-декларации, советы по модерации) — в [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## Лицензия

MIT — см. [LICENSE](LICENSE).

Проект не аффилирован с Morpho Labs. «Morpho» и знак с бабочкой Morpho являются товарными знаками соответствующих владельцев; базовый файл логотипа (`scripts/morpho-base.svg`) раздаётся публичным CDN Morpho.
