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
