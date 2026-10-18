# 進捗

STATUS: IN_PROGRESS
現在のタスク: T01
対象範囲: T01〜T12（M0 基盤＋M1 習慣。docs/SPEC.md §13）

<!--
STATUS は次のどれか。.claude/hooks/stop-gate.mjs がこの行を読む。
- IN_PROGRESS: 作業中。Claude Code は止まらずに次のタスクへ進む
- DONE: 完了の定義をすべて満たした。フックが lint・型・テスト・ビルド・E2E を実行して確かめる
- BLOCKED: 人の操作がないと進めない。「ブロック中の理由」に理由と必要な操作を書く
タスクの行は「- [ ] T01」で始める形を崩さない（フックが未完了のタスクを数える）。
-->

## タスク

各行の末尾に、完了時のコミットハッシュ（短縮形）と満たした受け入れ基準を書く。

- [ ] T01 プロジェクト作成、依存、TS strict、Tailwind、ルート、PWA、CSP、ESLint の層規則、Vitest、Playwright、scripts | commit: | AC: build
- [ ] T02 types / errors / dates / display とテスト | commit: | AC: CORE-01, 02
- [ ] T03 Dexie スキーマ、不変性フック、台帳、シード、設定のリポジトリ | commit: | AC: CORE-03, 04
- [ ] T04 copy/ja.ts、文言テスト、識別子テスト | commit: | AC: UX-05, 06
- [ ] T05 デザイントークン、共通コンポーネント、feedbackFor、音、振動、コマ | commit: | AC: UX-04, 09, 12
- [ ] T06 習慣のドメイン関数とテスト | commit: | AC: HAB-01, 02, 05, 06, 09〜13
- [ ] T07 習慣のリポジトリとテスト | commit: | AC: HAB-03, 04, 14
- [ ] T08 オンボーディングとリダイレクト | commit: | AC: CORE-06, 07
- [ ] T09 習慣作成ウィザードとペルソナ別の差分 | commit: | AC: HAB-08
- [ ] T10 きょうの道（習慣）、ホーム、理由カード、取り消し、過去の記録、＋シート | commit: | AC: CORE-05（習慣部分）, HAB-07, UX-01, 03
- [ ] T11 習慣の詳細・一覧・編集、グラフ、カレンダー、.ics | commit: | AC: HAB-15, 16
- [ ] T12 アイコン、マニフェスト、デプロイ用ワークフロー | commit: | AC: ビルド成果物の確認

## 完了の定義

- [ ] 上のタスクがすべて完了し、各行にコミットハッシュがある
- [ ] `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run e2e` がすべて通る
- [ ] 対象範囲のタスクに割り当てた【自動】受け入れ基準が、ID 付きのテストとしてすべて存在し、通る
- [ ] E2E「オンボーディング（診断スキップ）→ 習慣を作る → ホームで『やった』→ 取り消す → もう一度『やった』」が通る
- [ ] 作業ツリーに未コミットの変更がない
- [ ] 下の「人が確認すること」が最新

## 人が確認すること

- AC-UX-14: iPhone の Safari と Android の Chrome で、ホーム画面に追加して単体起動できる
- GitHub にリポジトリ `itte` を作り、push して、Settings → Pages の Source を GitHub Actions にする
- （実装中に増えたら追記する）

## ブロック中の理由

（STATUS: BLOCKED のときだけ書く。何が起きたか、試したこと、人に必要な操作）

## 作業ログ

新しいものを上に、1行ずつ書く。

- 
