# GBF Artifact Tool

Granblue Fantasy のアーティファクト管理を目的とした Chrome Extension プロジェクトです。

## 目的

ゲーム内のアーティファクト一覧を読み取り、ローカルで以下を行います。

- アーティファクト一覧管理
- スコアルール設定
- 独自スコア計算
- 必要 / 不要チェック
- CSV 出力

## 重要な制約

このツールは読み取り専用の補助ツールです。

禁止事項:

- ゲーム画面を操作しない
- ゲーム画面の UI を変更しない
- 自動周回、自動売却、自動強化などを行わない
- POST / PUT / DELETE など状態変更系リクエストを行わない
- 外部サーバーへユーザーデータを送信しない

## 採用方針

- Chrome Extension Manifest V3
- TypeScript
- Vite
- React
- Zustand
- API 取得方式
- Popup + Dedicated Dashboard Page 構成
- ローカル保存中心
- 過度な抽象化を避ける

## 画面構成

- Popup
  - スキャンモード / 管理モード切替
  - 現在ページのスキャン
  - 管理画面を開く
- Dashboard
  - アーティファクト一覧
  - フィルタ
  - スコアルール設定
  - 必要 / 不要チェック
  - CSV 出力

詳細は `docs/` 配下を参照してください。

## セットアップ

```bash
npm install
npm run build
```

開発中の確認:

```bash
npm run dev
```

品質チェック:

```bash
npm run check
```

整形:

```bash
npm run format
```

## Chrome への読み込み

1. `npm run build` を実行する
2. Chrome で `chrome://extensions` を開く
3. Developer mode を有効にする
4. Load unpacked で `dist/` を選択する

## 現在の実装範囲

- MV3 manifest
- Popup page
- Dashboard page
- Background service worker
- Content script
- Runtime message skeleton
- Artifact API / internal model type definitions
- Placeholder scan / manage mode state

スキャン処理はまだ API 取得を行いません。現時点の `Scan Current Page` は通信経路確認用のプレースホルダーで、ゲーム画面の操作、DOM 変更、外部送信は行いません。
