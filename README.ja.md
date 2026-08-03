# Morpho Enhancements

[English](README.md) · [简体中文](README.zh-CN.md) · **日本語** · [한국어](README.ko.md) · [Русский](README.ru.md) · [Español](README.es.md)

[app.morpho.org](https://app.morpho.org) の 4 つの不足を埋める Chrome 拡張です:

1. **マーケット単位の Supply / Withdraw** — Morpho Blue のマーケットページでは公式 UI が Borrow しか提供していません。本拡張は Borrow の隣に **Lend** タブを追加し、貸付資産を当該マーケットへ直接 deposit できるようにします(内部的には MetaMorpho vault と同じ `Morpho.supply()`)。あとから同じ UI で Withdraw も可能 — vault を経由せずにマーケット固有の貸付利息を稼げます。

2. **Dashboard での可視化** — 公式 dashboard は vault 預け入れと借入ポジションしか表示しないため、マーケットへの直接貸付が見えません。本拡張は **Market Lending** カードを追加し、拡張が対応する 10 チェーンでの直接貸付を USD 金額・APY・マーケットへのショートカット付きで表示します。

3. **`/variable` と `/vaults` のお気に入り** — 行頭のスターで任意のマーケット/vault をブックマークし、左下の **Favorites only** チップで気になる数件だけに絞り込めます。ブラウザ内に保存され、タブ間で同期します。

4. **ツールバー popup クイックビュー** — 拡張アイコンをクリックするだけで:*Prime* タブには Mainnet / Base / Arbitrum / OP の厳選 19 ブルーチップ・マーケットを supply APY、TVL、利用率、LLTV つきで表示。*Favorites* タブにはスター済みのマーケットと vault(V1 / V2 MetaMorpho 両対応)。APY または TVL でソート可能、行クリックで app.morpho.org の該当ページへ。

<p align="center">
  <img src="docs/screenshots/market-lend-light.png" width="360" alt="マーケットページ — Lend タブ(ライト)">
  <img src="docs/screenshots/market-lend-dark.png" width="360" alt="マーケットページ — Lend タブ(ダーク)">
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-card-light.png" width="720" alt="Dashboard — Market Lending カード(ライト)">
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-card-dark.png" width="720" alt="Dashboard — Market Lending カード(ダーク)">
</p>

<p align="center">
  <img src="docs/screenshots/favorites-markets-light.png" width="720" alt="Markets リスト — 各行のスターと Favorites チップ(ライト)">
</p>

<p align="center">
  <img src="docs/screenshots/favorites-markets-filtered-light.png" width="720" alt="Markets リスト — お気に入りのみ表示(ライト)">
</p>

<p align="center">
  <img src="docs/screenshots/popup-prime-light.png" width="320" alt="ツールバー popup — Prime タブ(ライト)">
  <img src="docs/screenshots/popup-favorites-light.png" width="320" alt="ツールバー popup — Favorites タブ(ライト)">
</p>

<p align="center">
  <img src="docs/screenshots/popup-prime-dark.png" width="320" alt="ツールバー popup — Prime タブ(ダーク)">
  <img src="docs/screenshots/popup-favorites-dark.png" width="320" alt="ツールバー popup — Favorites タブ(ダーク)">
</p>

> スクリーンショットはモックデータです。実残高、実アドレス、マーケットハッシュは公開画像には含まれません。

## 機能

- **Borrow | Lend タブ** — マーケットパネルに Lend タブを追加。ライト/ダーク両モードで Morpho のビジュアルに揃った Supply / Withdraw UI に切り替わります。
- **ETH / WETH 自動ラップ** — ローン資産がそのチェーンの wrapped-native の場合、ネイティブ通貨で支払えます。Supply は wrap、approve、USDT などの allowance リセットの要否により 1〜4 回の wallet transaction、native での withdraw は最大 2 回です。
- **マルチチェーン Dashboard** — Market Lending カードは拡張が対応する 10 チェーンを 1 回の multi-chain API query で取得します(100 position を超える場合は pagination)。対応チェーンの source of truth は [src/lib/chains.ts](src/lib/chains.ts) です。
- **リストページのお気に入り** — `/variable` と `/vaults` の行にスターを付け、ワンクリックで絞り込み。保存先は `chrome.storage.local` のみ(サーバー・トラッキングなし)、`chrome.storage.onChanged` でタブ間および popup と同期。
- **ツールバー popup の 2 タブ** — *Prime*(Mainnet / Base / Arbitrum / OP の厳選 19 ブルーチップ・マーケット)と *Favorites*(お気に入りのマーケットと vault、V1 / V2 MetaMorpho 両対応、行内に `V1`/`V2` の小さなチップ)。Stale-while-revalidate キャッシュ:5 分間のメモリ + `chrome.storage.local` 永続化により、popup を再オープンしても前回の値が即座に表示され、バックグラウンドで最新値に差し替え。APY ↓ または TVL ↓ でソート。
- **ページの injected wallet を再利用** — 別の WalletConnect session は作りません。サイトが未接続なら account access の承認を求められる場合があります。EIP-6963 と従来の `window.ethereum` provider(MetaMask、Rabby、Frame、Coinbase Wallet など)に対応します。
- **非標準 ERC-20 対応** — USDT のように `approve` が何も返さないトークンも素のまま動作。approve ABI を no outputs として宣言しているため、viem の simulation が `0x` で失敗しません。
- **人間が読めるエラー** — 署名拒否は静かに idle へ戻ります。残高不足、チェーン違い、nonce 詰まり、revert 理由などは 2 KB の viem ダンプではなく、短い文章になります。
- **アナリティクス・テレメトリ・バックエンド一切なし** — public RPC 経由で Morpho Blue 契約を直接呼び、APY / USD の数値取得にのみ Morpho 公式 API を使います。

## 仕組み

- **コントラクト** — market read と supply/withdraw は各対応チェーンの Morpho Blue singleton `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` を使います。`idToMarketParams(id)` で URL の market id をオンチェーンパラメータに解決、`supply(params, assets, 0, onBehalf, "0x")` で入金、`position(id, user)` + `market(id)` で残高計算。Approve と wrap/unwrap は loan token または native-wrapper contract を直接呼びます。
- **Wallet mediation** — wallet request は isolated content script から extension service worker に送られます。worker が送信元と RPC method を検証してから、`MAIN` world で限定された EIP-6963 / `window.ethereum` request を実行します。ページ script は `window.postMessage` から wallet path を呼び出せず、秘密鍵も保持しません。
- **データ** — `https://api.morpho.org/graphql` への軽量 GraphQL で APY と USD を取得。Shares-to-assets の計算は `sharesMath.ts` にローカルで移植済み。
- **UI** — 独立した Dashboard widget は React 19 + Shadow DOM を使用し、market の Lend form は Morpho 標準 Borrow の design token と utility class を継承するため light DOM にマウントします。SPA navigation は `history.pushState` / `replaceState` の patch と、animation 由来の DOM 変動を無視する throttle 付き `MutationObserver` で捕捉します。

## サポートチェーン

| slug (URL) | chainId | native / wrapped-native |
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

URL slug は `app.morpho.org/sitemap.xml` から取得し、chain ID は公式の [Morpho API 対応ネットワーク一覧](https://docs.morpho.org/developers/api/get-started/#supported-networks)と照合します。Wrapped-native contract address は [`src/lib/chains.ts`](src/lib/chains.ts) で管理し、各 chain の native wrapper deployment と照合します。

本拡張は現在、Morpho API 掲載ネットワークのうち 10 チェーンに対応しています。Robinhood Chain、Stable、Tempo は API に掲載されていますが、拡張では未対応です。

## インストール

### GitHub Releases から(手動インストール)

`v*` タグを push すると GitHub Actions がビルドし、ZIP を [Releases ページ](../../releases) に添付します。手順:

1. 最新 release の `morpho-enhancements-<version>-unpacked.zip` をダウンロード
2. 安定した場所(例: `~/extensions/morpho-enhancements/`)に展開
3. `chrome://extensions` を開く
4. 右上の **デベロッパーモード** をオン
5. **パッケージ化されていない拡張機能を読み込む** → 展開したフォルダを選択

Chrome は「デベロッパーモード拡張機能」の警告を表示します — ローカル拡張では常に出る想定内の表示です。Release artifact は store build と同じ機能ですが、更新は手動です。

### ソースから(開発用)

Node.js 20 以降と pnpm が必要です(lockfile は pnpm format 9)。

```bash
pnpm install
pnpm build
# Chrome → chrome://extensions → デベロッパーモードをオン → パッケージ化されていない拡張機能を読み込む → ./dist を選択
```

開発中は `pnpm dev`(Vite + crxjs HMR)を使います。

## テスト

```bash
# 完全な release gate: logic、build、live DOM probe、extension E2E、
# screenshot、Chrome Web Store ZIP
pnpm test:release

# 本番サイトに対する DOM プローブ(アンカーとサンプルレイアウト JSON を取得)
pnpm probe

# End-to-end — ビルド済み拡張を読み込んだ Chromium を起動。Lend タブ、
# dashboard マウント、ダークモード可読性、ウォレット分離、お気に入りの
# スター + フィルタ、ツールバー popup(タブ、ソート、V1/V2 vault レンダリング、
# chrome.storage キャッシュ)を検証
pnpm test:e2e
```

README スクリーンショットの再生成(GraphQL レスポンスはモック済みのため実残高は漏れません):

```bash
pnpm exec playwright test tests/e2e/screenshots.spec.ts
```

## プロジェクト構成

```
src/
├── background.ts             # 送信元検証・allow-list 付き wallet RPC service
├── manifest.config.ts        # MV3 manifest 宣言
├── content/
│   ├── main.ts               # ISOLATED world — SPA ルート監視 + マウント分配
│   ├── mount.ts              # Shadow DOM ホスト + React root + テーマ同期
│   ├── router.ts             # pushState/replaceState → locationchange イベント
│   ├── marketIntegration.ts  # マーケットパネルへの Borrow | Lend タブ注入
│   └── listsIntegration.ts   # /variable と /vaults のお気に入りスター + filter chip
├── lib/
│   ├── morpho.ts             # viem public client + Morpho コントラクトヘルパー
│   ├── morphoAbi.ts          # IMorpho + ERC20 + WETH9 ABI
│   ├── sharesMath.ts         # SharesMathLib 移植(virtual shares/assets)
│   ├── chains.ts             # Slug ↔ chain ID、wrapped-native、RPC フォールバック
│   ├── url.ts                # ルートマッチャ(market / dashboard / list / other)
│   ├── favorites.ts          # chrome.storage.local ベースのお気に入り + タブ間同期
│   ├── graphql.ts            # Morpho API クライアント(マーケット、V1/V2 vault、バッチ + SWR キャッシュ)
│   ├── pageProvider.ts       # service-worker RPC client + viem WalletClient adapter
│   └── walletRpcPolicy.ts    # wallet RPC の sender・method・parameter 検証
├── ui/
│   ├── MarketLendForm.tsx    # マーケットページの Supply / Withdraw フォーム(wrap トグル付)
│   ├── DashboardSupplyCard.tsx
│   ├── errorMessage.ts       # viem エラー → 短く親切なメッセージ
│   ├── format.ts             # bigint / USD / percent フォーマッタ
│   └── styles.css            # Shadow-DOM スコープのテーマ token
├── popup/
│   ├── index.html            # MV3 ツールバー popup エントリ
│   ├── main.tsx              # React root
│   ├── Popup.tsx             # タブ(Prime / Favorites)、ソートバー、行、リフレッシュ
│   ├── TokenIcon.tsx         # トークンアイコン(Morpho CDN → 文字 fallback)
│   └── popup.css             # ブランド banner、タブ、行、ライト + ダーク
├── data/
│   └── curatedMarkets.ts     # Prime 厳選リスト(19 マーケット、手動メンテ)
public/
├── icons/                    # scripts/make-logo.py で生成(16/32/48/128)
└── logo.svg                  # マスター SVG(Morpho 蝶 + enhancement バッジ)
scripts/
├── make-logo.py              # morpho-base.svg から拡張アイコンを再生成
└── morpho-base.svg           # 公式 Morpho 蝶(ソース)
tests/
├── unit/                     # route、math、chain、RPC policy、GraphQL contract test
├── probe/                    # app.morpho.org に対する live DOM compatibility probe
└── e2e/
    ├── extensionStorage.ts   # extension context の chrome.storage test helper
    ├── extension.spec.ts     # Lend タブ、dashboard マウント、ダークモード、ウォレット分離
    ├── favorites.spec.ts     # スター + フィルタ + extension storage 永続化
    ├── popup.spec.ts         # ツールバー popup — タブ、ソート、V1/V2 vault、キャッシュ、リフレッシュ
    └── screenshots.spec.ts   # README / ストア用スクリーンショット(モックデータ)
```

## セキュリティ

- コントラクト状態はチェーンごとに設定した 1〜4 個の public RPC で読み取り、複数 endpoint がある場合は viem fallback を使います。書き込みはユーザーのウォレット経由 — 拡張は秘密鍵を持たず、要求もしません。
- Morpho、approve、unwrap の書き込みは wallet prompt 前に simulate します。native wrap は直接送信し、各 receipt の成功を確認してから次へ進みます。
- 全額引き出しは利息累積時の精度 revert を避けるため shares で、部分引き出しは 0.01% 許容で assets を使用します。
- Host permissions は `https://app.morpho.org/*` のみ。`storage` はお気に入りと cache を local 保存し、`scripting` は sender 検証済み・allow-list 済みの wallet RPC だけを実行します。設定済み RPC、`api.morpho.org`、Morpho token-logo CDN 以外へデータを送りません。

## 既知の制約

- **1 トランザクション wrap + supply** は未実装。Morpho Bundler / GeneralAdapter で 1 回の multicall にまとめられますが、現状は wrap と allowance の状態により 1〜4 回の wallet transaction です。
- **WalletConnect のみ** のセッション(injected EIP-1193 provider がページに存在しない場合)は bridge が拾えません。
- **バンドルサイズ** v0.4.0 の現行 build は未圧縮 JavaScript 約 555 KiB(568,401 bytes)で、主に viem を含む content/popup chunk が占めます。正確な値は build ごとに変わります。

## 公開

Chrome Web Store への提出手順(zip 構造、listing コピー、プライバシー開示、審査のコツ)は [`docs/PUBLISHING.md`](docs/PUBLISHING.md) を参照。

## ライセンス

MIT — [LICENSE](LICENSE) を参照。

本プロジェクトは Morpho Labs とは無関係です。「Morpho」と Morpho 蝶のマークはそれぞれの所有者の商標であり、ベースロゴファイル(`scripts/morpho-base.svg`)は Morpho の公開 CDN で配信されています。
