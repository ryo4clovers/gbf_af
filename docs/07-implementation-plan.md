# Implementation Plan

## Phase 0: プロジェクト初期化

- TypeScript プロジェクト作成
- Manifest V3 構成
- Popup / Dashboard / Background / Content のビルド設定
- ESLint / Prettier / tsconfig 設定

成果物:

- `manifest.json`
- `src/background/index.ts`
- `src/content/index.ts`
- `src/popup/index.ts`
- `src/dashboard/index.ts`

## Phase 1: 型定義と正規化

- API レスポンス型を定義
- 内部モデルを定義
- RawArtifact -> Artifact の正規化関数を実装
- effect_value パーサを実装
- ユニットテストを追加

成果物:

- `src/api/artifactListTypes.ts`
- `src/domain/artifact.ts`
- `src/domain/normalizeArtifact.ts`
- `src/domain/parseEffectValue.ts`

## Phase 2: Storage

- Artifact 保存
- ScanState 保存
- UserMark 保存
- ScoreRule 保存

成果物:

- `src/storage/artifactStorage.ts`
- `src/storage/scanStateStorage.ts`
- `src/storage/scoreRuleStorage.ts`

## Phase 3: API 取得

- 現在ページが Artifact 画面か判定
- API URL の構築
- GET 実行
- レスポンス検証
- 保存

成果物:

- `src/api/fetchArtifactList.ts`
- `src/api/buildArtifactListUrl.ts`
- `src/background/scanCurrentPage.ts`

禁止:

- 自動ページ送り
- POST / PUT / DELETE
- ゲーム画面操作

## Phase 4: Popup

- 現在モード表示
- scan / manage 切替
- 現在ページをスキャン
- スキャン結果表示
- Dashboard を開く

成果物:

- `src/popup/Popup.tsx` または `src/popup/index.ts`
- `src/shared/messages.ts`

## Phase 5: Dashboard

- 保存済み Artifact 読み込み
- 一覧表示
- フィルタ
- ソート
- UserMark 操作
- Summary 表示

成果物:

- `src/dashboard/Dashboard.tsx` または `src/dashboard/index.ts`
- `src/dashboard/artifactTable.ts`
- `src/dashboard/filterArtifacts.ts`

## Phase 6: スコア計算

- ScoreRule 定義
- デフォルトルール
- 独自スコア計算
- 理由表示
- ルール編集 UI

成果物:

- `src/domain/scoreRule.ts`
- `src/domain/calculateCustomScore.ts`
- `src/dashboard/scoreRuleEditor.ts`

## Phase 7: CSV 出力

- CSV 変換
- カラム定義
- ダウンロード
- 文字化け対策

成果物:

- `src/csv/csvColumns.ts`
- `src/csv/exportArtifactsCsv.ts`

## Phase 8: 品質改善

- エラーハンドリング
- ログ整理
- テスト追加
- サンプル JSON による回帰テスト
- README 整備

## 優先順位

1. 型定義
2. 正規化
3. Storage
4. API 取得
5. Popup
6. Dashboard
7. CSV
8. スコア編集

## Codex / Claude Code への実装指示

最初は UI よりもデータ処理を優先する。

特に以下を先に実装すること。

- API レスポンス型
- 内部モデル
- 正規化関数
- effect_value パーサ
- 保存処理
- サンプル JSON を使ったテスト
