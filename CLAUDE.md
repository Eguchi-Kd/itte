# 一手（itte）

単一ユーザー向けの日本語 PWA。習慣・着手・盤面・段の4モジュールを、ホーム「きょうの道」と週次ふりかえりで束ねる。サーバーなし、データは端末内の IndexedDB だけ。

仕様の正本は `docs/SPEC.md`。優先順位は §0.1（絶対制約と不変条件 → 受け入れ基準 → データとドメイン → 画面 → その他）。

作業の状態は `docs/progress.md` が正本。会話の記憶より、このファイルとコミット履歴を信じる。会話が圧縮されたら、このファイルと `git log --oneline -15` を読み直してから再開する。`docs/progress.md` の `STATUS:` 行とタスク行（`- [ ] T01`）の形は崩さない（Stop フック `.claude/hooks/stop-gate.mjs` が読んでいる）。

## 進め方

- `docs/SPEC.md` §13「実装順序」のタスクを番号順に、1タスク＝1コミットで進める。コミットメッセージは `feat(T07): 習慣作成ウィザード` の形式
- 各タスクの終わりに `npm run lint && npm run typecheck && npm run test` を通す。E2E を含むタスクは `npm run e2e` も通す
- タスク完了時に、満たした受け入れ基準の ID（例: AC-HAB-03）を報告する
- テスト名の先頭に受け入れ基準の ID を付ける

## 絶対に守ること

- 仕様にない機能、画面、ライブラリを追加しない。必要だと思ったら実装せず `docs/questions.md` に書く
- SPEC §15 の未解決の論点は推測で埋めない。`// TODO(spec): 15-<番号>` を残して報告する
- ストリーク、XP、スコア、バッジ、レベル、リーグ、祝福演出、達成率のゲージを作らない。`streak` `xp` `badge` `confetti` `league` `leaderboard` という識別子を src/ に置かない
- UI 文言はすべて `src/copy/ja.ts` に置く。禁止語（すごい、えらい、頑張、失敗、サボ、達成、目標）、感嘆符、絵文字を使わない
- フィードバック（色・音・振動・動き・文言の調子）は結果に依存させない。届いた／届かなかった、やった／記録なし、好手／悪手で見た目を変えない
- 外部通信をしない（解析、外部フォント、CDN、外部 API なし）。催促の通知を作らない
- 追記専用テーブル（measurements, predictions, affectActuals, commitments, judgmentRequests, judgments, judgmentCorrections, deadlineExtensions, goalFollowUps）を更新・削除するコードを書かない。追加は必ず `appendImmutable` を通す
- 段（Goal）を期限なしで作れる経路を作らない

## コードの規約

- TypeScript strict、`any` 禁止。識別子・列名は英語、UI は日本語
- `src/domain/` は純粋関数だけ。React・Dexie・`Date.now()`・引数なしの `new Date()` を使わない。現在時刻と今日は引数で受け取る
- 画面は DB を直接触らない。読み取りは `src/db/queries/`、書き込みは `src/db/repo/` を通す
- 日付は午前4時を境界にした論理日（`logicalDate`）。日付文字列を `toISOString()` で作らない
- 瞬間は epoch ms、日付は `YYYY-MM-DD`
- テストは `TZ=Asia/Tokyo`、基準日時は 2026-10-18（日）12:00
