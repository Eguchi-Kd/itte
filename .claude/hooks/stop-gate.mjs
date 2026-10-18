#!/usr/bin/env node
// Stop フック: プロトタイプの完了の定義を満たすまで、Claude Code が作業を止めないようにする。
// 止めてよいのは次のどれかのときだけ。
//   1. docs/progress.md の STATUS が BLOCKED（人の操作が必要）
//   2. STATUS が DONE で、未完了タスクがなく、作業ツリーがきれいで、検証コマンドがすべて通った
//   3. 安全弁: このフックが MAX_BLOCKS 回続けて止めるのを拒んだ
// フックが止めるのを拒むときは exit 2 で理由を stderr に出す。Claude Code はその理由を読んで作業を続ける。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PROGRESS = 'docs/progress.md';
const STATE_DIR = '.claude';
const COUNTER = `${STATE_DIR}/.stop-gate-count`;
const VERIFIED = `${STATE_DIR}/.stop-gate-verified`;
const MAX_BLOCKS = 40;
const VERIFY = ['npm run lint', 'npm run typecheck', 'npm run test', 'npm run build', 'npm run e2e'];

const allow = () => process.exit(0);
const block = (msg) => {
  // stderr に「ファイルが見つからない」という文が入ると、Claude Code はフック自体のエラーとみなして止まってしまうので言い換える
  const safe = msg.replace(/No such file or directory/g, 'file not found').replace(/ENOENT/g, 'E_NOFILE');
  process.stderr.write(safe + '\n');
  process.exit(2);
};

try { readFileSync(0); } catch { /* 入力は使わない */ }

if (!existsSync(PROGRESS)) allow();

const text = readFileSync(PROGRESS, 'utf8');
const status = (text.match(/^STATUS:\s*([A-Z_]+)/m) || [])[1] || 'IN_PROGRESS';
if (status === 'BLOCKED') allow();

if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
const count = existsSync(COUNTER) ? Number(readFileSync(COUNTER, 'utf8')) || 0 : 0;
if (count >= MAX_BLOCKS) allow();
const refuse = (msg) => {
  writeFileSync(COUNTER, String(count + 1));
  block(`${msg}\n（停止の拒否 ${count + 1}/${MAX_BLOCKS} 回目）`);
};

const open = [...text.matchAll(/^- \[ \] (T\d{2})\s/gm)].map((m) => m[1]);

if (status !== 'DONE') {
  refuse(
    `プロトタイプはまだ完成していません。未完了: ${open.join(', ') || '（タスクはすべてチェック済み。完了の定義を確認）'}。` +
      `docs/progress.md を読み、${open[0] ?? '完了の定義の確認'} から作業を続けてください。ユーザーの確認は待たないでください。` +
      `人の操作がないと進めない場合だけ、STATUS: BLOCKED にして「ブロック中の理由」を書いてください。`,
  );
}

if (open.length) refuse(`STATUS: DONE ですが、未完了のタスクがあります: ${open.join(', ')}。STATUS を IN_PROGRESS に戻して続けてください。`);

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
let head = '';
try {
  head = sh('git rev-parse HEAD');
  if (sh('git status --porcelain')) refuse('STATUS: DONE ですが、未コミットの変更があります。コミットしてから終えてください。');
} catch {
  refuse('STATUS: DONE ですが、git のリポジトリがないかコミットがありません。git init してタスクごとにコミットしてください。');
}

if (existsSync(VERIFIED) && readFileSync(VERIFIED, 'utf8').trim() === head) allow();

for (const cmd of VERIFY) {
  try {
    execSync(cmd, { stdio: 'pipe', encoding: 'utf8', timeout: 600_000 });
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    refuse(
      `STATUS: DONE ですが \`${cmd}\` が失敗しました。STATUS を IN_PROGRESS に戻し、原因を直してからもう一度 DONE にしてください。\n` +
        `--- 出力の末尾 ---\n${out.slice(-3000)}`,
    );
  }
}

writeFileSync(VERIFIED, head);
writeFileSync(COUNTER, '0');
allow();
