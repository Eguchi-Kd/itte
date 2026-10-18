# 実装中の不明点と、決めたこと

Claude Code が実装中に追記する。形式:

- [T07] 質問 or 決めたこと: 〜（関連: SPEC §6.5.1 / TODO(spec): 15-6）

## 決めたこと

- [T01] 決めたこと: Node 20.18 で動く版にそろえた。jsdom は 27 が Node 20.19 以上を要るため 26 にした。TypeScript は typescript-eslint が 6.1 未満までしか対応しないため 5.9 にした（§11.1 の「TypeScript 5」どおり）（関連: SPEC §11.1）
- [T01] 決めたこと: §11.2 の一覧にないが、Vite の react-ts 雛形に含まれる react、react-dom、vite、@vitejs/plugin-react、typescript、@types/react、@types/react-dom、@types/node と、@testing-library/react の必須の相手 @testing-library/dom を入れた。新しい機能のためのライブラリではない（関連: SPEC §11.1, §11.2）
- [T01] 決めたこと: npm 10.9 で peer 依存の解決が落ちる不具合（`Cannot read properties of null (reading 'edgesOut')`）があり、vitest と jsdom だけ `--legacy-peer-deps` で入れた（関連: SPEC §11.2）
- [T01] 決めたこと: 型検査は app（src）、node（設定ファイルと E2E）、test（tests/unit。fs を使うので node の型を足す）の3つに分けた（関連: SPEC §11.3）
- [T01] 決めたこと: コミットは自分のハッシュを中に書けないので、progress.md の各タスク行のハッシュは次のタスクのコミットで書き足す。T12 のハッシュは完了のコミットで書く（関連: PROMPT「1タスクの進め方」7）
- [T01] 決めたこと: アプリ名は src/config.ts の APP_NAME に置き、src/copy/ja.ts の app.name はそれを参照する（関連: SPEC §1.2）
- [T03] 決めたこと: verifyLedger の結果の reason は 'chain'（連鎖の切れ）／'hash'（レコードの書き換え）／'missing'（台帳にあるレコードがない）／'unlisted'（台帳にないレコード）。'unlisted' の seq は最後のエントリの次の番号にした（関連: SPEC §7.5）
- [T03] 決めたこと: 不変性のフックは updating と deleting に加え、Dexie 4 では clear() と Collection.delete() も deleting フックを通るので、すべて IMMUTABLE で止まることをテストした（関連: SPEC §7.4 I2）
- [T03] 決めたこと: リポジトリ関数は §7.6 の「すべて now を引数で受け取る」に合わせ、getSettings と updateSettings も now を受け取る（初回作成の createdAt に使う）（関連: SPEC §7.6）
- [T04] 決めたこと: 初期データの理由タグと定跡の文言も禁止語テストの対象にするため、src/copy/ja.ts（seed.reasonTags、board.joseki）に置き、src/db/seed.ts から参照する（関連: SPEC §7.7, §5.7-4）
- [T04] 決めたこと: §6.4 の「スキップ」は付録 A の common.skip（「とばす」）を使う。付録 A を確定版として優先した（関連: SPEC §6.4, 付録 A）
- [T04] 決めたこと: AC-UX-06 は、streak・badge・confetti・league・leaderboard を部分文字列で、xp を camelCase／snake_case で区切った単語として検査する（関連: SPEC §12.9）
- [T05] 決めたこと: §5.8 の共通コンポーネントのうち、M1 で使わないもの（RingTimer、ScoreInput、DateChips、CheckSheet、TwoStepConfirm、CalibrationChart、QuickActionSheet 以外の着手・盤面・段の部品）は、使うタスク（T16、T21、T24、T25、T26、T31）で作る。MonthCalendar と WeeklyBarChart は T11、QuickActionSheet は T10 で作る（関連: SPEC §5.8, §13）
- [T05] 決めたこと: 画面の形式（タブ・一覧・レッスン・ウィザード・タイマー・シート・通常）を src/ui/routePolicy.ts の1か所で決め、下部タブ・更新の割り込み・コマの表示可否をそこから引く。コマは判定・タイマー・逃避ログのルートでは自分で描画しない（詰まりシートはタイマーの上のモーダルなので同じルート）（関連: SPEC §5.7, §6.1.1, X7）
- [T05] 決めたこと: 取り消しのある記録（ホームの「やった」など）はスナックバー（5秒）、取り消しのない記録（レッスンの保存など）はフィードバックシート（1.2秒）を出す。どちらも feedbackFor の同じ音・振動・見た目を使う（関連: SPEC §5.8, §2.2）
- [T05] 決めたこと: 習慣の詳細と編集は「通常」の画面として下部タブを隠し、閉じる・戻るボタンで戻る（§6.1.1「詳細の編集では隠す」に合わせ、詳細も一覧の外なので隠す）（関連: SPEC §6.1.1）
