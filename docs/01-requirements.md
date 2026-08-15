# Requirements

## 目的

Granblue Fantasy のアーティファクト(AF)情報を、ユーザーがローカルで管理・評価・確認・CSV出力できるようにする。

このツールは Chrome Extension として動作するが、GBF のゲーム画面やゲーム状態を操作しない。

アーティファクト情報は、GBF ページ自身が取得した `/rest/artifact/list/{page}` の network response を観測して取得する。

## 基本方針

このツールは observation-only の補助ツールである。

### 行うこと

- GBF ページ自身の artifact list response を観測する
- 観測した response を validation する
- アーティファクト情報を内部モデルへ正規化する
- IndexedDB にローカル保存する
- Side Panel / Dashboard で管理・表示する
- rating / memo などのユーザーレビュー情報をローカル保存する
- 統計情報をローカルデータから計算する
- CSV をローカルで生成する
- 将来的に custom score をローカルで計算する

### 行わないこと

- GBF DOM を変更しない
- GBF ページへ UI を挿入しない
- GBF API へ拡張機能独自の request を送信しない
- 自動ページ遷移を行わない
- 自動周回、自動売却、自動強化、自動装備を行わない
- POST / PUT / DELETE など状態変更系 request を送信しない
- polling / retry により GBF 側通信を増やさない
- 外部サーバーへユーザーのアーティファクトデータを送信しない

## 機能要件

### R-001: アーティファクト一覧レスポンス観測

GBF ページ自身が発行した `/rest/artifact/list/{page}` の response を観測できること。

要件:

- page-context の fetch / XHR observer で network response を観測する
- content bridge 経由で background service worker へ response を渡す
- background service worker で response を validation する
- validation 成功後に domain model へ正規化する
- 拡張機能独自の GBF artifact API request は送信しない

禁止:

- URL を組み立てて `fetch` すること
- `uid`, `_`, `t` などの query parameter を使って request を再現すること
- 自動で次ページを取得すること

### R-002: Scan Mode

scan mode では、観測した artifact list response を保存対象として扱う。

要件:

- scan mode の開始 / 停止ができること
- scan mode 中に観測した artifact list response を保存すること
- 現在の scan status を Side Panel に表示すること
- scan mode 以外の観測結果を、誤って lifecycle 更新に使わないこと
- scan mode の責務は artifact collection と lifecycle update に限定すること

### R-003: ScanSession 管理

スキャン単位を `ScanSession` として管理できること。

要件:

- scan session の開始時刻を記録する
- scan session の終了時刻を記録する
- 観測済みページを記録する
- 期待される最終ページを記録する
- completed / cancelled / error などの状態を区別できること
- active scan session を復元できること

目的:

- full scan が完了したか判断する
- possiblyDeleted 判定の根拠を明確にする
- scan の途中中断や extension reload に耐える

### R-004: ArtifactPresence 管理

各アーティファクトの存在状態を `ArtifactPresence` として管理できること。

要件:

- 初回観測日時を記録する
- 最終観測日時を記録する
- 最終観測 scan session を記録する
- 現在も存在している artifact と、存在しない可能性がある artifact を区別する
- completed full scan 後に、観測されなかった artifact を `possiblyDeleted` として扱えること
- legacy data に対して backfill できること

禁止:

- partial scan の結果だけで安易に削除扱いにすること
- user review metadata を presence 判定で削除すること

### R-005: ローカル保存

観測・正規化したアーティファクト情報を IndexedDB に保存できること。

要件:

- artifact は `ownedId` を主キーとして保存する
- 同一 `ownedId` の artifact は再スキャンで上書き更新する
- scan metadata を保存する
- scan session を保存する
- artifact presence を保存する
- user review metadata を artifact 本体とは分離して保存する
- 保存済みデータを全件取得できること
- 必要に応じて保存済み artifact を削除できること

主な store:

- `artifacts`
- `scanMetadata`
- `artifactUserReviews`
- `scanSessions`
- `artifactPresence`

### R-006: User Review Metadata

ユーザーが artifact に対して review metadata を付与できること。

要件:

- rating を 0〜5 で設定できること
- memo を保存できること
- rating / memo は artifact 本体と分離して保存すること
- 再スキャンしても rating / memo が保持されること
- display mode / dashboard の双方で review metadata を参照できること

禁止:

- scan 結果で rating / memo を消すこと
- GBF 側の `is_unnecessary` と user review を混同すること

### R-007: Manage Mode

manage mode では、保存済み artifact を管理できること。

要件:

- Dashboard で保存済み artifact 一覧を表示できること
- artifact の詳細情報を確認できること
- skill 1〜4 を確認できること
- game score を確認できること
- rating / memo を編集できること
- lifecycle 状態を確認できること
- custom score 実装後は score と score reason を確認できること

### R-008: Dashboard

Dashboard はローカル保存済み artifact の管理画面として動作すること。

要件:

- artifact list を表示する
- フィルタできる
- ソートできる
- CSV export できる
- statistics summary を表示できる
- rating / memo を編集できる
- lifecycle filtering ができる
- 単一の custom score settings editor を提供できる構成にする

### R-009: Filtering

Dashboard で artifact を絞り込めること。

初期または既存の候補:

- keyword
- attribute
- kind
- skill name
- locked state
- equipped state
- rating
- lifecycle status
- game score
- future custom score

### R-010: Sorting

Dashboard で artifact を並び替えできること。

候補:

- ownedId
- name
- attribute
- kind
- level
- game score total
- rating
- scannedAt
- lifecycle status
- future custom score

### R-011: Statistics

保存済み artifact から統計情報を計算・表示できること。

要件:

- overall counts
- rating distribution
- attribute distribution
- kind distribution
- skill summary

方針:

- statistics は in-memory で計算する
- 初期実装では statistics を永続化しない
- 保存済み artifact と user review metadata から都度計算する

### R-012: CSV Export

保存済み artifact を CSV として出力できること。

要件:

- ローカルデータのみからCSVを生成する
- 外部サーバーへ送信しない
- artifact基本情報を出力する
- skill 1〜4 の情報を出力する
- game score を出力する
- rating / memo を出力する
- lifecycle status を出力する
- future custom score を出力できる構成にする

初期カラム候補:

- ownedId
- artifactTypeId
- name
- kind
- attribute
- level
- maxLevel
- locked
- equippedCharacter
- lifecycleStatus
- rating
- memo
- gameAttackScore
- gameDefenseScore
- gameSpecialScore
- gameTotalScore
- customScore
- skill1Name
- skill1Level
- skill1Quality
- skill1EffectValue
- skill2Name
- skill2Level
- skill2Quality
- skill2EffectValue
- skill3Name
- skill3Level
- skill3Quality
- skill3EffectValue
- skill4Name
- skill4Level
- skill4Quality
- skill4EffectValue
- scannedAt

### R-013: Display Mode

display mode では、現在GBF側で表示・観測された artifact page を Side Panel に表示できること。

要件:

- current observed GBF artifact page を表示する
- 5-column grid で artifact を表示する
- rating を表示する
- memo tooltip を表示する
- artifact persistence は行わない
- lifecycle update は行わない
- scan session update は行わない

目的:

- GBF画面を見ながら、Side Panelで補助的に rating / memo を確認する
- ゲーム画面自体には手を加えない

### R-014: Side Panel

Side Panel は拡張機能のメイン入口として動作すること。

要件:

- mode controls を表示する
- scan controls を表示する
- scan status を表示する
- display companion view を表示する
- dashboard を開く導線を提供する

禁止:

- Popup前提のUIへ戻すこと
- GBFページへUIを挿入すること

### R-015: Content Bridge Recovery

extension reload や stale content script に対して復旧できること。

要件:

- content bridge に ping できること
- content bridge が存在しない場合に再注入できること
- 再注入後に再度 ping できること
- page observer を idempotent に注入できること
- start / stop observing message を安全に送れること

関連概念:

- `ensureContentBridge(tabId)`
- `PING_CONTENT_BRIDGE`
- idempotent content bridge injection
- stale content-script recovery

### R-016: Custom Score System

ユーザーが独自の評価軸で artifact を評価できること。

Phase 1 では、自由数式エディタではなく rule-based scoring とする。

ユーザー入力:

- 複数の理想スキル構成（属性・武器種・1～2枠・3枠・4枠）
- 1～2枠・3枠・4枠ごとの全スキルの点数（0～25）

スコア評価:

```text
finalScore =
  max(
    idealRouteScore,
    priorityRouteScore
  )
````

#### idealRouteScore

理想構成にどれだけ近いかを評価する。

属性と武器種に該当する単一構成を使用し、未選択のスキル枠は一致として扱う。

```text
idealRouteScore =
  ideal match score
  + table multiplier for matched ideal skills
```

要件:

* 1/4, 2/4, 3/4, 4/4 の4段階で一致判定する
* 1～2枠は順不同、3枠と4枠は対応する枠で判定する
* 未選択枠は一致として扱う
* 理想構成に含まれるスキルの効果量テーブルを補正する

#### priorityRouteScore

単体スキル価値を評価する。

```text
priorityRouteScore =
  sum of per-skill scores
  + table multiplier
```

要件:

* 各枠グループの全スキルへ0～25の整数点を設定する
* 4枠の基礎点合計は最大100とする
* 不要スキル情報はスコア計算へ使用しない

#### Effect Table

要件:

* a〜e の effect table rank を扱えること
* `e` を最も高く評価する
* `a` を最も低く評価する
* table rank は独立加点ではなく、skill base score に対する multiplier として扱う
* 「欲しいスキルの d」が「微妙なスキルの e」より高くなるようにする

#### Skill Level Baseline

要件:

* Phase 1 では Lv1 想定で評価する
* 現在の skill level と長期的価値を混ぜない
* skill level reset が可能である前提を反映する

### R-017: Score Explanation

custom score の結果は、ユーザーが理由を確認できること。

要件:

* total score を表示する
* selected route を表示する
* ideal route score を表示する
* priority route score を表示する
* score reasons を表示する

例:

```text
Score: 87
Route: ideal
+ 3/4 ideal match
+ 通常攻撃ダメージ上限 rank e
+ 自属性攻撃力 rank d
```

または:

```text
Score: 64
Route: priority
+ 通常攻撃ダメージ上限 rank e
+ 自属性攻撃力 rank d
```

## 非機能要件

### NFR-001: Safety

このツールはゲーム操作を行わない。

要件:

* GBF DOM を変更しない
* GBFページへUIを挿入しない
* GBF APIへ独自requestを送信しない
* ゲーム状態変更requestを送信しない
* 自動ページ遷移しない
* polling / retryでGBF通信を増やさない
* 外部送信しない

### NFR-002: Local-first

ユーザーデータはローカルに閉じる。

要件:

* artifact data は IndexedDB に保存する
* rating / memo は IndexedDB に保存する
* custom score settings は IndexedDB に保存する
* CSV はローカルで生成する
* 外部サーバーへ同期しない

### NFR-003: Maintainability

API response、domain model、UI、score policy を分離する。

要件:

* API response type と domain model を分ける
* normalization を UI から分離する
* score evaluation を UI から分離する
* CSV generation を UI から分離する
* storage access を domain logic から分離する
* custom score policy と calculated score result を分離する

### NFR-004: Debuggability

問題発生時に原因を追いやすいこと。

要件:

* response validation error を区別する
* bridge connection error を区別する
* observer injection error を区別する
* IndexedDB error を区別する
* scan session state を確認できる
* artifact presence state を確認できる
* score reason を確認できる
* ユーザー向けには短いエラーを表示し、詳細は console に出す

### NFR-005: MV3 Compatibility

Manifest V3 の service worker lifecycle を考慮する。

要件:

* background state が常駐する前提にしない
* 必要な状態は IndexedDB から復元できるようにする
* content bridge の stale 状態に対応する
* observer injection は idempotent にする

### NFR-006: Performance

通常利用で重くならないこと。

要件:

* Dashboard の統計計算は必要なタイミングで行う
* 不要な永続化を避ける
* 不要な polling を行わない
* 大量の artifact でも filter / sort / CSV export が実用的に動作する
* custom score evaluator は pure function とし、必要に応じて再計算しやすくする

### NFR-007: Explainability

ユーザーが管理判断を理解できること。

要件:

* custom score は理由付きで表示する
* rating / memo と score を混同しない
* game score と custom score を区別して表示する
* lifecycle status の意味をUI上で理解できるようにする

## 対象外

以下は対象外。

* 自動周回
* 自動売却
* 自動強化
* 自動装備
* 自動ページ遷移
* ゲーム画面の改変
* ゲーム画面へのUI挿入
* GBF APIへの独自request
* 状態変更request
* 他ユーザーとのデータ共有
* クラウド同期
* 外部サーバー保存
* 完全自由形式の数式エディタ

## 将来検討

以下は将来検討とする。

* custom score preset

  * normal attack
  * ougi
  * ability damage
  * defense
  * general use
* custom score import / export
* advanced formula editor
* custom score settings import / export
* character-specific evaluation
* attribute-specific evaluation
* more detailed skill normalization
* score cache with explicit invalidation
