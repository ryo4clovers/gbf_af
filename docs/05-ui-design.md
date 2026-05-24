# UI Design

## 採用形式

管理操作画面は Dedicated Page として実装する。

```txt
chrome-extension://<extension-id>/dashboard.html
```

Popup は補助操作、Dashboard は管理操作に分離する。

## Popup

### 目的

- 短時間の操作
- 現在ページのスキャン
- 管理画面への導線

### 画面要素

```txt
Popup
├─ Header
│  └─ GBF Artifact Tool
├─ Mode
│  ├─ scan
│  └─ manage
├─ Scan Panel
│  ├─ 現在ページをスキャン
│  ├─ 現在ページ
│  ├─ 最終ページ
│  ├─ 取得済みページ
│  └─ 最終スキャン日時
└─ Actions
   ├─ 管理画面を開く
   └─ 保存データ確認
```

### Popup でやらないこと

- 大量の一覧表示
- 複雑なフィルタ
- スコアルール編集
- CSV カラム詳細設定

## Dashboard

### 目的

管理操作の中心。

### 画面構成

```txt
Dashboard
├─ Header
│  ├─ タイトル
│  ├─ 最終スキャン日時
│  ├─ 総件数
│  └─ CSV出力
├─ Summary Cards
│  ├─ 総数
│  ├─ ロック数
│  ├─ 装備中
│  ├─ keep
│  ├─ trash
│  └─ review
├─ Filter Bar
│  ├─ キーワード
│  ├─ 属性
│  ├─ 種類
│  ├─ スキル名
│  ├─ ロック状態
│  ├─ 装備状態
│  └─ ユーザーマーク
├─ Artifact Table
│  ├─ 基本情報
│  ├─ スキル
│  ├─ ゲーム内スコア
│  ├─ 独自スコア
│  └─ ユーザーマーク
└─ Rule Panel
   ├─ スコアルール一覧
   ├─ ルール追加
   ├─ ルール編集
   └─ ルールインポート/エクスポート
```

## Artifact Table カラム案

- Mark
- Name
- Attribute
- Kind
- Level
- Locked
- Equipped
- Game Total Score
- Custom Score
- Skill 1
- Skill 2
- Skill 3
- Skill 4
- Actions

## Mark 操作

```txt
none   : 未判定
keep   : 必要
trash  : 不要候補
review : 要確認
```

注意:

- Mark はツール内だけの状態。
- ゲーム内 `is_unnecessary` は変更しない。
- ゲーム側状態とツール側判断を並べて表示する。

## UI 実装方針

初期実装ではシンプルな HTML + TypeScript でよい。

React を使う場合は以下を守る。

- 状態を局所化しすぎない
- スコア計算や CSV 生成を React component に書かない
- domain 層にロジックを分離する
- 表示用 ViewModel を用意する

## Dashboard 起動

```ts
chrome.tabs.create({
  url: chrome.runtime.getURL("dashboard.html"),
});
```

## UX 方針

- まず一覧が見える
- フィルタは軽量
- 重要な操作はローカル完結
- 失敗時の理由を短く表示
- 詳細ログは console に出す
