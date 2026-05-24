# Architecture

## 全体構成

```txt
Chrome Extension
├─ Popup
│  ├─ モード切替
│  ├─ 現在ページをスキャン
│  └─ 管理画面を開く
├─ Content Script
│  └─ 現在タブのURL/ページ状態確認
├─ Background Service Worker
│  ├─ API取得
│  ├─ メッセージ中継
│  └─ Dashboard起動
├─ Dashboard Page
│  ├─ Artifact一覧
│  ├─ フィルタ
│  ├─ スコアルール設定
│  └─ CSV出力
├─ Storage
│  └─ ローカル永続化
└─ Domain
   ├─ 正規化
   ├─ スコア計算
   └─ CSV変換
```

## 役割

### Popup

短時間の操作に限定する。

- scan / manage の状態表示
- 現在ページをスキャン
- `dashboard.html` を開く

Popup は一覧管理には使わない。

### Dashboard

管理操作の中心。

- 広い画面で一覧・検索・設定・出力を行う。
- URL は `chrome.runtime.getURL("dashboard.html")` で開く。

### Content Script

ページ操作は行わない。

許可:

- 現在 URL の確認
- ページが Artifact 画面かの判定
- 必要に応じた読み取り専用 DOM 確認

禁止:

- click
- submit
- input 変更
- DOM 追加
- CSS 変更
- ゲーム画面 UI へのボタン挿入

### Background Service Worker

Chrome Extension の権限が必要な処理を担当する。

- API 取得
- ローカル保存
- Popup / Dashboard との通信
- Dashboard タブの作成

## データフロー

### スキャン

```txt
User
  ↓
GBF Artifact Page を手動で開く
  ↓
Popup: 「現在ページをスキャン」
  ↓
Background: /rest/artifact/list/{page} を GET
  ↓
API Response
  ↓
Normalizer
  ↓
Storage
  ↓
Popup に結果表示
```

### 管理

```txt
User
  ↓
Popup: 「管理画面を開く」
  ↓
dashboard.html
  ↓
Storage から Artifact / Rules を読み込み
  ↓
フィルタ / スコア計算 / CSV 出力
```

## API取得方式の方針

- ユーザーが Artifact 画面を開いている時だけ取得する。
- API URL は現在ページ情報から推定する。
- `_`, `t`, `uid` はハードコードしない。
- GET のみ許可する。
- 自動で `next` を辿らない。

## エラー設計

代表的なエラー:

- Artifact 画面ではない
- API URL を構築できない
- API 取得に失敗
- JSON パースに失敗
- レスポンス形式が想定外
- 保存に失敗

UI では短く表示し、開発者向け詳細は console に出す。
