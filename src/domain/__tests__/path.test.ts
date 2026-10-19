import { describe, expect, it } from 'vitest';
import { buildTodayPath, DEFAULT_PATH_FLAGS, MAX_INTERRUPTS, unscheduledHabits, type PathInput } from '../path';
import { reviewTargetWeek } from '../review/weekly';
import { habit, log, TODAY } from './habitFixtures';
import { session, task } from './startFixtures';

const NOW = new Date(2026, 9, 18, 12, 0).getTime();

function weekOf(p: ReturnType<typeof buildTodayPath>) {
  const n = p.nodes[0];
  return n.kind === 'habit' ? n.weekCount : undefined;
}

/** 週次ふりかえりのノードを除いた道 */
function build(i: PathInput, now: number) {
  const p = buildTodayPath(i, now);
  return { ...p, nodes: p.nodes.filter((n) => n.kind !== 'weekly') };
}

function input(p: Partial<PathInput> = {}): PathInput {
  return {
    today: TODAY,
    persona: null,
    flags: DEFAULT_PATH_FLAGS,
    habits: [],
    habitLogs: [],
    tasks: [],
    sessions: [],
    goals: [],
    judgmentRequests: [],
    moves: [],
    candidates: [],
    // 既定では今週のふりかえりは済んでいる（週次のノードは専用のテストで確かめる）
    weeklyRuns: [{ id: 'w', weekStart: '2026-10-12', startedAt: 0, completedAt: 1, cursor: 9 }],
    startUsed: false,
    integrityFailed: false,
    backupDue: false,
    dailyDone: false,
    dismissed: {},
    ...p,
  };
}

// 日曜（今日）の予定: 時刻つき 21:00／07:00／07:00（後で作成）、時刻なし2件、予定外1件、終了1件
const habits = [
  habit({ id: 'night', name: '日記', schedule: { days: [0], time: '21:00', cue: null }, createdAt: 1 }),
  habit({ id: 'cueB', name: 'ストレッチ', schedule: { days: [0, 6], time: null, cue: '夕食のあと' }, createdAt: 5 }),
  habit({ id: 'morning2', name: '散歩', schedule: { days: [0], time: '07:00', cue: null }, createdAt: 4 }),
  habit({ id: 'cueA', name: '読書', schedule: { days: [0], time: null, cue: '寝る前' }, createdAt: 2 }),
  habit({ id: 'morning1', name: '英単語', schedule: { days: [0, 1], time: '07:00', cue: null }, createdAt: 3 }),
  habit({ id: 'weekday', name: '筋トレ', schedule: { days: [1, 2, 3, 4, 5], time: '06:00', cue: null }, createdAt: 6 }),
  habit({ id: 'ended', name: '終了', status: 'ended', endedOn: '2026-10-10', createdAt: 7 }),
];

describe('buildTodayPath（習慣の部分）', () => {
  it('AC-CORE-05: 時刻つきの習慣を時刻順、続いて時刻なしを createdAt 順に並べる', () => {
    const path = build(input({ habits }), NOW);
    expect(path.nodes.map((n) => (n.kind === 'habit' ? n.habitId : n.id))).toEqual(['morning1', 'morning2', 'night', 'cueA', 'cueB']);
    expect(path.nodes.every((n) => n.kind === 'habit')).toBe(true);
  });

  it('AC-CORE-05: nextNodeId は最初の未完了ノードで、そのノードだけ next', () => {
    const logs = [log(TODAY, true, { habitId: 'morning1', amount: 12 }), log(TODAY, false, { habitId: 'morning2' })];
    const path = build(input({ habits, habitLogs: logs }), NOW);
    expect(path.nextNodeId).toBe('habit:morning2'); // 記録なし（done=false）は完了ではない
    expect(path.nodes.map((n) => n.state)).toEqual(['done', 'next', 'todo', 'todo', 'todo']);
    const [first, second] = path.nodes;
    expect(first.kind === 'habit' && first.recordedAmount).toBe(12);
    expect(second.kind === 'habit' && second.recordedAmount).toBeNull();
  });

  it('AC-CORE-05: すべて完了していれば nextNodeId は null。予定がなければノードもない', () => {
    const logs = ['morning1', 'morning2', 'night', 'cueA', 'cueB'].map((id) => log(TODAY, true, { habitId: id }));
    const path = build(input({ habits, habitLogs: logs }), NOW);
    expect(path.nextNodeId).toBeNull();
    expect(path.nodes.every((n) => n.state === 'done')).toBe(true);
    expect(build(input(), NOW)).toEqual({ interrupts: [], nodes: [], nextNodeId: null, otherTasks: [] });
  });

  it('AC-CORE-05: active でない習慣（今日まで予定日の定着済み・終了）は道に出さない', () => {
    const graduated = habit({ id: 'grad', status: 'graduated', endedOn: TODAY, schedule: { days: [0], time: '06:00', cue: null } });
    const ended = habit({ id: 'end', status: 'ended', endedOn: TODAY, schedule: { days: [0], time: null, cue: 'x' } });
    const path = build(input({ habits: [...habits, graduated, ended] }), NOW);
    expect(path.nodes.map((n) => (n.kind === 'habit' ? n.habitId : n.id))).toEqual(['morning1', 'morning2', 'night', 'cueA', 'cueB']);
  });

  it('AC-CORE-05: optimist のときだけ「今週 {done}/{scheduled} 回」を添える', () => {
    const h = [habit({ id: 'a', schedule: { days: [1, 3, 5, 0], time: null, cue: 'x' } })];
    const logs = [log('2026-10-12', true, { habitId: 'a' }), log('2026-10-14', true, { habitId: 'a' })];
    expect(weekOf(build(input({ habits: h, habitLogs: logs }), NOW))).toBeNull();
    for (const persona of ['regret', 'meaning', 'selfblame', 'notfun'] as const) {
      expect(weekOf(build(input({ habits: h, habitLogs: logs, persona }), NOW))).toBeNull();
    }
    const opt = build(input({ habits: h, habitLogs: logs, persona: 'optimist' }), NOW);
    expect(weekOf(opt)).toEqual({ done: 2, scheduled: 4 });
  });

  it('ノードは実行意図の1文と単位を持つ', () => {
    const path = build(input({ habits: [habits[4]] }), NOW);
    expect(path.nodes[0]).toMatchObject({ name: '英単語', unit: '分', intention: '月・日曜の7:00に、机で、英単語を10分' });
  });
});

describe('割り込みカード（記録なしの理由）', () => {
  const h = [habit({ id: 'a', startedOn: '2026-10-10' })];

  it('過去3日の未記録の予定日があれば「記録なしの理由」を出し、最大2枚', () => {
    const path = build(input({ habits: h, habitLogs: [log('2026-10-16', true, { habitId: 'a' })] }), NOW);
    expect(path.interrupts).toEqual([
      {
        id: 'reason',
        prompts: [
          { habitId: 'a', date: '2026-10-15' },
          { habitId: 'a', date: '2026-10-17' },
        ],
      },
    ]);
    expect(path.interrupts.length).toBeLessThanOrEqual(MAX_INTERRUPTS);
  });

  it('「あとで」を押した論理日の間は出さない', () => {
    expect(build(input({ habits: h, dismissed: { reason: TODAY } }), NOW).interrupts).toEqual([]);
    expect(build(input({ habits: h, dismissed: { reason: '2026-10-17' } }), NOW).interrupts).toHaveLength(1);
  });
});

describe('今日は予定のない習慣', () => {
  it('active で今日が予定日でない習慣を返す', () => {
    expect(unscheduledHabits(habits, TODAY).map((x) => x.id)).toEqual(['weekday']);
  });
});

describe('buildTodayPath（やること）', () => {
  const tasks = [
    task({ id: 'b', title: 'B', createdAt: 2 }),
    task({ id: 'a', title: 'A', nextStep: '見出しを足す', createdAt: 1 }),
    task({ id: 'c', title: 'C', createdAt: 3 }),
  ];

  it('AC-START-02: 今日のやることは最大1件で createdAt が最も古いもの。残りは「他のやること」に入る', () => {
    const path = build(input({ tasks }), NOW);
    const taskNodes = path.nodes.filter((n) => n.kind === 'task');
    expect(taskNodes).toHaveLength(1);
    expect(taskNodes[0]).toMatchObject({ taskId: 'a', state: 'next' });
    expect(path.otherTasks.map((t) => t.id)).toEqual(['b', 'c']);
  });

  it('AC-START-02: 片づけたものと別の日のものは今日のやることに入らない', () => {
    const list = [task({ id: 'x', createdAt: 0, archivedAt: NOW }), task({ id: 'y', createdAt: 0, plannedFor: '2026-10-19' }), ...tasks];
    const path = build(input({ tasks: list }), NOW);
    expect(path.nodes.find((n) => n.kind === 'task')).toMatchObject({ taskId: 'a' });
    expect(path.otherTasks.map((t) => t.id)).toEqual(['b', 'c']);
  });

  it('やることのノードは習慣の後で、次の一手（なければタイトル）を出し、A 条件ではタイトルを出す', () => {
    const p = build(input({ habits: [habit({ id: 'h' })], tasks }), NOW);
    expect(p.nodes.map((n) => n.kind)).toEqual(['habit', 'task']);
    expect(p.nodes[1]).toMatchObject({ label: '見出しを足す', title: 'A', state: 'todo' });
    const a = build(input({ tasks, flags: { judgmentEnforced: true, roughStart: false } }), NOW);
    expect(a.nodes[0]).toMatchObject({ label: 'A' });
    const noNext = build(input({ tasks: [task({ id: 'z', title: 'Z' })] }), NOW);
    expect(noNext.nodes[0]).toMatchObject({ label: 'Z' });
  });

  it('今日そのやることでセッションを始めていれば完了', () => {
    const started = session({ taskId: 'a', startedAt: NOW - 3600_000, endedAt: NOW - 3000_000, outcome: 'stopped' });
    const p = build(input({ tasks, sessions: [started] }), NOW);
    expect(p.nodes[0]).toMatchObject({ kind: 'task', state: 'done' });
    expect(p.nextNodeId).toBeNull();
  });
});

describe('割り込みカード（再開・持ち越し）', () => {
  it('持ち越しは予定日が今日より前の未片づけのやること。あとでを押した日は出さない', () => {
    const tasks = [task({ id: 'old', plannedFor: '2026-10-16' }), task({ id: 'now' })];
    expect(build(input({ tasks }), NOW).interrupts).toEqual([{ id: 'carry', tasks: [tasks[0]] }]);
    expect(build(input({ tasks, dismissed: { carry: TODAY } }), NOW).interrupts).toEqual([]);
  });

  it('優先順は 再開 → 記録なしの理由 → 持ち越し で、最大2枚', () => {
    const tasks = [task({ id: 'old', plannedFor: '2026-10-16' })];
    const running = session({ taskId: 'old', startedAt: NOW - 4 * 60_000 });
    const h = [habit({ id: 'p', startedOn: '2026-10-16' })];
    const p = build(input({ tasks, sessions: [running], habits: h }), NOW);
    expect(p.interrupts.map((c) => c.id)).toEqual(['resume', 'reason']);
    expect(p.interrupts[0]).toMatchObject({ sessionId: 's1', startedAt: NOW - 4 * 60_000, remainingMs: 6 * 60_000 });
    const noRun = build(input({ tasks, habits: h }), NOW);
    expect(noRun.interrupts.map((c) => c.id)).toEqual(['reason', 'carry']);
  });
});

describe('buildTodayPath（1日のしめ）', () => {
  it('AC-CORE-05: 着手モジュールを使ったことがあるときだけ、しめのノードを最後に置く', () => {
    expect(build(input({ habits: [habit({ id: 'h' })] }), NOW).nodes.map((n) => n.kind)).toEqual(['habit']);
    const p = build(input({ habits: [habit({ id: 'h' })], tasks: [task()], startUsed: true }), NOW);
    expect(p.nodes.map((n) => n.kind)).toEqual(['habit', 'task', 'daily']);
    expect(p.nodes[2]).toMatchObject({ id: 'daily', state: 'todo' });
  });

  it('AC-CORE-05: 習慣とやることが済んでいれば、しめが next。しめも済めば nextNodeId は null', () => {
    const started = session({ taskId: 't1', startedAt: NOW - 3600_000, endedAt: NOW - 3000_000, outcome: 'stopped' });
    const base = { habits: [habit({ id: 'h' })], habitLogs: [log(TODAY, true, { habitId: 'h' })], tasks: [task()], sessions: [started], startUsed: true };
    expect(build(input(base), NOW).nextNodeId).toBe('daily');
    const done = build(input({ ...base, dailyDone: true }), NOW);
    expect(done.nextNodeId).toBeNull();
    expect(done.nodes.map((n) => n.state)).toEqual(['done', 'done', 'done']);
  });
});

describe('buildTodayPath（決めかけの手）', () => {
  const move = (id: string, createdAt: number, p: Record<string, unknown> = {}) => ({
    id,
    triggerId: null,
    situation: `局面${id}`,
    mode: 'full' as const,
    retro: false,
    irreversible: false,
    unreadable: false,
    chosenCandidateId: null,
    chosenText: null,
    decidedAt: null,
    phase: null,
    createdAt,
    ...p,
  });
  const cands = [
    { id: 'c2', moveId: 'm1', position: 2 as const, description: '断る', plus1: null, plus2: null, score: null },
    { id: 'c1', moveId: 'm1', position: 1 as const, description: '行く', plus1: null, plus2: null, score: null },
  ];

  it('AC-CORE-05: 決めかけの手を作成の古い順に、習慣とやることより前に並べる', () => {
    const moves = [move('m2', NOW - 1000), move('m1', NOW - 2 * 86400000), move('old', NOW - 7 * 86400000), move('done', NOW, { decidedAt: NOW })];
    const p = build(input({ moves, candidates: cands, habits: [habit({ id: 'h' })], tasks: [task()], startUsed: true }), NOW);
    expect(p.nodes.map((n) => n.id)).toEqual(['decide:m1', 'decide:m2', 'habit:h', 'task:t1', 'daily']);
    expect(p.nextNodeId).toBe('decide:m1');
    expect(p.nodes[0]).toMatchObject({ kind: 'decide', situation: '局面m1', candidates: [{ id: 'c1', description: '行く' }, { id: 'c2', description: '断る' }] });
  });
});

describe('buildTodayPath（判定）', () => {
  const g = (id: string, deadline: string, p: Record<string, unknown> = {}) => ({
    id,
    parentId: null,
    recutOfId: null,
    metricId: 'm',
    title: `段${id}`,
    targetValue: 3,
    comparator: 'GTE' as const,
    deadline,
    status: 'OPEN' as const,
    createdAt: 0,
    hiddenAt: null,
    ...p,
  });
  const goals = [g('late', '2026-10-16'), g('early', '2026-10-10'), g('noreq', '2026-10-12'), g('met', '2026-10-09', { status: 'MET' })];
  const reqs = ['late', 'early', 'met'].map((goalId) => ({ goalId, requestedAt: 0, detectedAt: 0 }));
  const move = { id: 'm1', triggerId: null, situation: '局面', mode: 'full' as const, retro: false, irreversible: false, unreadable: false, chosenCandidateId: null, chosenText: null, decidedAt: null, phase: null, createdAt: NOW - 1000 };

  it('AC-CORE-05: 判定・決めかけの手・時刻つき習慣・時刻なし習慣・やること・しめの順に並べ、nextNodeId は最初の未完了', () => {
    const habitsMixed = [
      habit({ id: 'cue', schedule: { days: [0], time: null, cue: '寝る前' }, createdAt: 1 }),
      habit({ id: 'timed', schedule: { days: [0], time: '07:00', cue: null }, createdAt: 2 }),
    ];
    const p = build(
      input({ goals, judgmentRequests: reqs, moves: [move], habits: habitsMixed, tasks: [task()], startUsed: true }),
      NOW,
    );
    expect(p.nodes.map((n) => n.id)).toEqual(['judge:early', 'judge:late', 'decide:m1', 'habit:timed', 'habit:cue', 'task:t1', 'daily']);
    expect(p.nextNodeId).toBe('judge:early');
    expect(p.nodes[0]).toMatchObject({ kind: 'judge', state: 'next', title: '段early', deadline: '2026-10-10' });
  });

  it('AC-CORE-05: 実験の A 条件（judgmentEnforced=false）では判定ノードが消える', () => {
    const p = build(input({ goals, judgmentRequests: reqs, flags: { judgmentEnforced: false, roughStart: true } }), NOW);
    expect(p.nodes.filter((n) => n.kind === 'judge')).toEqual([]);
  });
});

describe('週次ふりかえり', () => {
  it('AC-REV-01: reviewTargetWeek は論理日の金・土・日はその週、月は前の週、火〜木は null', () => {
    expect(reviewTargetWeek('2026-10-16')).toBe('2026-10-12'); // 金
    expect(reviewTargetWeek('2026-10-17')).toBe('2026-10-12'); // 土
    expect(reviewTargetWeek('2026-10-18')).toBe('2026-10-12'); // 日
    expect(reviewTargetWeek('2026-10-19')).toBe('2026-10-12'); // 月（前の週）
    expect(reviewTargetWeek('2026-10-20')).toBeNull(); // 火
    expect(reviewTargetWeek('2026-10-21')).toBeNull();
    expect(reviewTargetWeek('2026-10-15')).toBeNull(); // 木
  });

  it('AC-REV-01: 週次ふりかえりのノードは金〜月にだけ、未完了なら todo（next）で出る', () => {
    const base = { weeklyRuns: [] };
    for (const [today, expected] of [
      ['2026-10-15', null],
      ['2026-10-16', '2026-10-12'],
      ['2026-10-18', '2026-10-12'],
      ['2026-10-19', '2026-10-12'],
      ['2026-10-20', null],
    ] as const) {
      const p = buildTodayPath(input({ ...base, today }), NOW);
      const node = p.nodes.find((n) => n.kind === 'weekly');
      if (expected === null) expect(node).toBeUndefined();
      else expect(node).toMatchObject({ kind: 'weekly', weekStart: expected, state: 'next' });
    }
  });

  it('AC-REV-01: その週のふりかえりが完了していれば未完了のノードは出ない（完了の印で残る）', () => {
    const run = { id: 'w', weekStart: '2026-10-12', startedAt: 0, completedAt: null, cursor: 3 };
    expect(buildTodayPath(input({ weeklyRuns: [run] }), NOW).nodes.find((n) => n.kind === 'weekly')?.state).toBe('next');
    const done = buildTodayPath(input({ weeklyRuns: [{ ...run, completedAt: NOW }] }), NOW);
    expect(done.nodes.find((n) => n.kind === 'weekly')?.state).toBe('done');
    expect(done.nextNodeId).toBeNull();
    // 前の週の完了は今週の分に数えない
    const other = buildTodayPath(input({ weeklyRuns: [{ ...run, weekStart: '2026-10-05', completedAt: NOW }] }), NOW);
    expect(other.nodes.find((n) => n.kind === 'weekly')?.state).toBe('next');
  });

  it('AC-CORE-05: 週次ふりかえりはやることの後、しめの前', () => {
    const p = buildTodayPath(input({ weeklyRuns: [], tasks: [task()], startUsed: true }), NOW);
    expect(p.nodes.map((n) => n.kind)).toEqual(['task', 'weekly', 'daily']);
  });
});

describe('割り込みカード（整合性・バックアップ）', () => {
  it('優先順は 記録なしの理由 → 持ち越し → 整合性 → バックアップ で、最大2枚。あとでを押した日は出さない', () => {
    const p1 = build(input({ integrityFailed: true, backupDue: true }), NOW);
    expect(p1.interrupts.map((c) => c.id)).toEqual(['integrity', 'backup']);
    const h = [habit({ id: 'p', startedOn: '2026-10-16' })];
    expect(build(input({ habits: h, integrityFailed: true, backupDue: true }), NOW).interrupts.map((c) => c.id)).toEqual(['reason', 'integrity']);
    expect(build(input({ backupDue: true, dismissed: { backup: TODAY } }), NOW).interrupts).toEqual([]);
  });
});
