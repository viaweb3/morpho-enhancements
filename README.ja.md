# Morpho Enhancements

[English](README.md) · [简体中文](README.zh-CN.md) · **日本語** · [한국어](README.ko.md) · [Русский](README.ru.md) · [Español](README.es.md)

[app.morpho.org](https://app.morpho.org) の 3 つの不足を埋める Chrome 拡張です:

1. **マーケット単位の Supply / Withdraw** — Morpho Blue のマーケットページでは公式 UI が Borrow しか提供していません。本拡張は Borrow の隣に **Lend** タブを追加し、貸付資産を当該マーケットへ直接 deposit できるようにします(内部的には MetaMorpho vault と同じ `Morpho.supply()`)。あとから同じ UI で Withdraw も可能 — vault を経由せずにマーケット固有の貸付利息を稼げます。

2. **Dashboard での可視化** — 公式 dashboard は vault 預け入れと借入ポジションしか表示しないため、マーケットへの直接貸付が見えません。本拡張は **Market Lending** カードを追加し、Morpho がサポートする全チェーンでのユーザーの直接貸付を USD 金額・APY・マーケットへのショートカット付きで表示します。

3. **`/markets` と `/vaults` のお気に入り** — 行頭のスターで任意のマーケット/vault をブックマークし、左下の **Favorites only** チップで気になる数件だけに絞り込めます。ブラウザ内に保存され、タブ間で同期します。

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

> スクリーンショットはモックデータです。実残高、実アドレス、マーケットハッシュは公開画像には含まれません。

## 機能

- **Borrow | Lend タブ** — マーケットパネルに Lend タブを追加。ライト/ダーク両モードで Morpho のビジュアルに揃った Supply / Withdraw UI に切り替わります。
- **ETH / WETH 自動ラップ** — ローン資産がそのチェーンの wrapped-native(Polygon の POL、Monad の MON、HyperEVM の HYPE など)の場合、ネイティブ通貨で支払えるトグルが出ます。Supply 前に自動 wrap、Withdraw 後に自動 unwrap。署名は合計 2 回のみで、wrap 用の別 UX 遷移はありません。
- **10 チェーン Dashboard** — Market Lending カードは Ethereum、Base、Arbitrum、Optimism、Polygon、Unichain、Monad、World Chain、Katana、HyperEVM を 1 リクエストで取得します。
- **リストページのお気に入り** — `/markets` と `/vaults` の行にスターを付け、ワンクリックで絞り込み。保存先は `localStorage` のみ(サーバー・トラッキングなし)、オフラインで動作し、タブ間で同期。
- **ページの既存ウォレットを再利用** — 二度目の connect フローは不要。MetaMask、Rabby、Frame、Coinbase Wallet ほか、EIP-6963 に準拠する任意の injected ウォレットで動作します。
- **非標準 ERC-20 対応** — USDT のように `approve` が何も返さないトークンも素のまま動作。approve ABI を no outputs として宣言しているため、viem の simulation が `0x` で失敗しません。
- **人間が読めるエラー** — 署名拒否は静かに idle へ戻ります。残高不足、チェーン違い、nonce 詰まり、revert 理由などは 2 KB の viem ダンプではなく、短い文章になります。
- **アナリティクス・テレメトリ・バックエンド一切なし** — public RPC 経由で Morpho Blue 契約を直接呼び、APY / USD の数値取得にのみ Morpho 公式の blue-api を使います。

## 仕組み

- **コントラクト** — 読み書きは全て Morpho Blue のシングルトン `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`(全サポートチェーンで CREATE2 により同一アドレス)。`idToMarketParams(id)` で URL の market id をオンチェーンパラメータに解決、`supply(params, assets, 0, onBehalf, "0x")` で入金、`position(id, user)` + `market(id)` で残高計算。
- **Wallet bridge** — `world: "MAIN"` の content script が EIP-6963 discovery(+ 旧来の `window.ethereum` フォールバック)を実装し、EIP-1193 リクエストを `window.postMessage` で isolated content script にプロキシ。その上に viem の `WalletClient` を構築。秘密鍵は決して保持しません。
- **データ** — `https://blue-api.morpho.org/graphql` への軽量 GraphQL で APY と USD を取得。Shares-to-assets の計算は `sharesMath.ts` にローカルで移植済み。
- **UI** — React 19 を Shadow DOM 内にマウントし、スタイルが Morpho ページに漏れない(逆も然り)構成。SPA ナビゲーションは `history.pushState` / `replaceState` のパッチと、アニメーション由来の DOM 変動を無視するスロットル付き `MutationObserver` で捕捉。

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

Slug は `app.morpho.org/sitemap.xml` から、アドレスは [`morpho-blue-api-metadata`](https://github.com/morpho-org/morpho-blue-api-metadata) からです。

## インストール

### GitHub Releases から(Chrome Web Store 審査待ちの間に推奨)

`v*` タグを push すると GitHub Actions がビルドし、ZIP を [Releases ページ](../../releases) に添付します。手順:

1. 最新 release の `morpho-enhancements-<version>-unpacked.zip` をダウンロード
2. 安定した場所(例: `~/extensions/morpho-enhancements/`)に展開
3. `chrome://extensions` を開く
4. 右上の **デベロッパーモード** をオン
5. **パッケージ化されていない拡張機能を読み込む** → 展開したフォルダを選択

Chrome は「デベロッパーモード拡張機能」の警告を表示します — ローカル拡張では常に出る想定内の表示です。Chrome Web Store の審査が通るとワンクリックインストールになりますが数日かかるので、機能的にはこの経路で同一です。

### ソースから(開発用)

```bash
pnpm install
pnpm build
# Chrome → chrome://extensions → デベロッパーモードをオン → パッケージ化されていない拡張機能を読み込む → ./dist を選択
```

開発中は `pnpm dev`(Vite + crxjs HMR)を使います。

## テスト

```bash
# 本番サイトに対する DOM プローブ(アンカーとサンプルレイアウト JSON を取得)
pnpm probe

# End-to-end — ビルド済み拡張を読み込んだ Chromium を起動し、Lend タブ、
# dashboard マウント、ダークモード可読性、provider bridge を検証
pnpm test:e2e
```

README スクリーンショットの再生成(GraphQL レスポンスはモック済みのため実残高は漏れません):

```bash
pnpm exec playwright test tests/e2e/screenshots.spec.ts
```

## プロジェクト構成

```
src/
├── manifest.config.ts        # MV3 manifest 宣言
├── content/
│   ├── main.ts               # ISOLATED world — SPA ルート監視 + マウント分配
│   ├── mount.ts              # Shadow DOM ホスト + React root + テーマ同期
│   ├── router.ts             # pushState/replaceState → locationchange イベント
│   ├── marketIntegration.ts  # マーケットパネルへの Borrow | Lend タブ注入
│   └── listsIntegration.ts   # /markets と /vaults のお気に入りスター + filter chip
├── lib/
│   ├── morpho.ts             # viem public client + Morpho コントラクトヘルパー
│   ├── morphoAbi.ts          # IMorpho + ERC20 + WETH9 ABI
│   ├── sharesMath.ts         # SharesMathLib 移植(virtual shares/assets)
│   ├── chains.ts             # Slug ↔ chain ID、wrapped-native、RPC フォールバック
│   ├── url.ts                # ルートマッチャ(market / dashboard / list / other)
│   ├── favorites.ts          # localStorage ベースのお気に入りストア
│   ├── graphql.ts            # blue-api クライアント
│   └── pageProvider.ts       # bridge クライアント + viem WalletClient アダプタ
├── ui/
│   ├── MarketLendForm.tsx    # マーケットページの Supply / Withdraw フォーム(wrap トグル付)
│   ├── DashboardSupplyCard.tsx
│   ├── errorMessage.ts       # viem エラー → 短く親切なメッセージ
│   ├── format.ts             # bigint / USD / percent フォーマッタ
│   └── styles.css            # Shadow-DOM スコープのテーマ token
public/
├── icons/                    # scripts/make-logo.py で生成(16/32/48/128)
├── logo.svg                  # マスター SVG(Morpho 蝶 + enhancement バッジ)
└── injected/
    └── provider-bridge.js    # アプリコードとバンドルしない MAIN-world の素 JS bridge
scripts/
├── make-logo.py              # morpho-base.svg から拡張アイコンを再生成
└── morpho-base.svg           # 公式 Morpho 蝶(ソース)
tests/
├── probe/                    # app.morpho.org に対する DOM スクレイプ
└── e2e/
    ├── extension.spec.ts     # 機能 E2E
    └── screenshots.spec.ts   # README / ストア用スクリーンショット(モックデータ)
```

## セキュリティ

- コントラクト状態は public RPC で読み取り(viem により 1 チェーンあたり 4 provider のフォールバック)。書き込みはユーザーのウォレット経由 — 拡張は秘密鍵を持たず、要求もしません。
- 全ての書き込みは `writeContract` 前に `simulateContract` するため、revert はウォレット署名前に読める形で表面化します。
- 全額引き出しは利息累積時の精度 revert を避けるため shares で、部分引き出しは 0.01% 許容で assets を使用します。
- Host permissions は `https://app.morpho.org/*` のみ。ユーザー設定の RPC、`blue-api.morpho.org`、Morpho のトークンロゴ CDN 以外にデータは送られません。

## 既知の制約

- **1 トランザクション wrap + supply** は未実装。Morpho Bundler / GeneralAdapter で wrap + approve + supply を 1 回の multicall にまとめられますが、現状は 2〜3 署名の分割です。
- **WalletConnect のみ** のセッション(injected EIP-1193 provider がページに存在しない場合)は bridge が拾えません。
- **バンドルサイズ** は gzip 前 ~530 KB で、viem が支配的。将来の版で viem のチェーン/コントラクトコードを動的 import に切り替え予定。

## 公開

Chrome Web Store への提出手順(zip 構造、listing コピー、プライバシー開示、審査のコツ)は [`docs/PUBLISHING.md`](docs/PUBLISHING.md) を参照。

## ライセンス

MIT — [LICENSE](LICENSE) を参照。

本プロジェクトは Morpho Labs とは無関係です。「Morpho」と Morpho 蝶のマークはそれぞれの所有者の商標であり、ベースロゴファイル(`scripts/morpho-base.svg`)は Morpho の公開 CDN で配信されています。
