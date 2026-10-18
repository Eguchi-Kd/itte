# 進捗

STATUS: IN_PROGRESS
現在のタスク: T10
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

- [x] T01 プロジェクト作成、依存、TS strict、Tailwind、ルート、PWA、CSP、ESLint の層規則、Vitest、Playwright、scripts | commit: 4805f5b | AC: build
- [x] T02 types / errors / dates / display とテスト | commit: ada87ff | AC: CORE-01, 02
- [x] T03 Dexie スキーマ、不変性フック、台帳、シード、設定のリポジトリ | commit: 27da1de | AC: CORE-03, 04
- [x] T04 copy/ja.ts、文言テスト、識別子テスト | commit: 76fb008 | AC: UX-05, 06
- [x] T05 デザイントークン、共通コンポーネント、feedbackFor、音、振動、コマ | commit: dc4db6b | AC: UX-04, 09, 12
- [x] T06 習慣のドメイン関数とテスト | commit: c2e350d | AC: HAB-01, 02, 05, 06, 09〜13
- [x] T07 習慣のリポジトリとテスト | commit: 780d44e | AC: HAB-03, 04, 14
- [x] T08 オンボーディングとリダイレクト | commit: ebf42db | AC: CORE-06, 07
- [x] T09 習慣作成ウィザードとペルソナ別の差分 | commit: | AC: HAB-08
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

- 2026-10-19 T09 習慣作成ウィザード（4ステップ、小さく始めるガード、実行意図の確認）とペルソナ別の差分（AC-HAB-08）
- 2026-10-19 T08 オンボーディング（はじめる・タイプ診断5問の自動送り・入口の4択）、未オンボーディング時のリダイレクト、最初の E2E（AC-CORE-06, 07）
- 2026-10-19 T07 習慣のリポジトリ（記録・取り消し・記録なし・保存・状態・週次チェック・対策・理由タグ）とテスト（AC-HAB-03, 04, 14）
- 2026-10-19 T06 習慣のドメイン関数（予定日・統計・ガード・理由・傾向・自動化・レビュー・実行意図）とテスト（AC-HAB-01, 02, 05, 06, 09〜13）
- 2026-10-19 T05 デザイントークン、共通コンポーネント、feedbackFor・音・振動、コマ、画面の形式の判定（AC-UX-04, 09, 12）
- 2026-10-19 T04 copy/ja.ts（付録 A ＋画面の文言）、文言テスト、識別子テスト（AC-UX-05, 06）
- 2026-10-19 T03 Dexie スキーマ、不変性フック、台帳（canonicalJSON・appendImmutable・verifyLedger）、シード、設定のリポジトリ（AC-CORE-03, 04）
- 2026-10-19 T02 types / errors / dates / display とテスト（AC-CORE-01, 02）
- 2026-10-19 T01 雛形、依存、TS strict、Tailwind、全ルートの空画面、PWA（prompt）、CSP、ESLint の層規則、Vitest、Playwright。npm run build が通る
