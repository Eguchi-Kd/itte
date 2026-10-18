import { describe, expect, it } from 'vitest';
import { buildTodayPath, DEFAULT_PATH_FLAGS, MAX_INTERRUPTS, unscheduledHabits, type PathInput } from '../path';
import { habit, log, TODAY } from './habitFixtures';

const NOW = new Date(2026, 9, 18, 12, 0).getTime();

function input(p: Partial<PathInput> = {}): PathInput {
  return {
    today: TODAY,
    persona: null,
    flags: DEFAULT_PATH_FLAGS,
    habits: [],
    habitLogs: [],
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
    const path = buildTodayPath(input({ habits }), NOW);
    expect(path.nodes.map((n) => n.habitId)).toEqual(['morning1', 'morning2', 'night', 'cueA', 'cueB']);
    expect(path.nodes.every((n) => n.kind === 'habit')).toBe(true);
  });

  it('AC-CORE-05: nextNodeId は最初の未完了ノードで、そのノードだけ next', () => {
    const logs = [log(TODAY, true, { habitId: 'morning1', amount: 12 }), log(TODAY, false, { habitId: 'morning2' })];
    const path = buildTodayPath(input({ habits, habitLogs: logs }), NOW);
    expect(path.nextNodeId).toBe('habit:morning2'); // 記録なし（done=false）は完了ではない
    expect(path.nodes.map((n) => n.state)).toEqual(['done', 'next', 'todo', 'todo', 'todo']);
    expect(path.nodes[0].recordedAmount).toBe(12);
    expect(path.nodes[1].recordedAmount).toBeNull();
  });

  it('AC-CORE-05: すべて完了していれば nextNodeId は null。予定がなければノードもない', () => {
    const logs = ['morning1', 'morning2', 'night', 'cueA', 'cueB'].map((id) => log(TODAY, true, { habitId: id }));
    const path = buildTodayPath(input({ habits, habitLogs: logs }), NOW);
    expect(path.nextNodeId).toBeNull();
    expect(path.nodes.every((n) => n.state === 'done')).toBe(true);
    expect(buildTodayPath(input(), NOW)).toEqual({ interrupts: [], nodes: [], nextNodeId: null });
  });

  it('AC-CORE-05: optimist のときだけ「今週 {done}/{scheduled} 回」を添える', () => {
    const h = [habit({ id: 'a', schedule: { days: [1, 3, 5, 0], time: null, cue: 'x' } })];
    const logs = [log('2026-10-12', true, { habitId: 'a' }), log('2026-10-14', true, { habitId: 'a' })];
    expect(buildTodayPath(input({ habits: h, habitLogs: logs }), NOW).nodes[0].weekCount).toBeNull();
    const opt = buildTodayPath(input({ habits: h, habitLogs: logs, persona: 'optimist' }), NOW);
    expect(opt.nodes[0].weekCount).toEqual({ done: 2, scheduled: 4 });
  });

  it('ノードは実行意図の1文と単位を持つ', () => {
    const path = buildTodayPath(input({ habits: [habits[4]] }), NOW);
    expect(path.nodes[0]).toMatchObject({ name: '英単語', unit: '分', intention: '月・日曜の7:00に、机で、英単語を10分' });
  });
});

describe('割り込みカード（記録なしの理由）', () => {
  const h = [habit({ id: 'a', startedOn: '2026-10-10' })];

  it('過去3日の未記録の予定日があれば「記録なしの理由」を出し、最大2枚', () => {
    const path = buildTodayPath(input({ habits: h, habitLogs: [log('2026-10-16', true, { habitId: 'a' })] }), NOW);
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
    expect(buildTodayPath(input({ habits: h, dismissed: { reason: TODAY } }), NOW).interrupts).toEqual([]);
    expect(buildTodayPath(input({ habits: h, dismissed: { reason: '2026-10-17' } }), NOW).interrupts).toHaveLength(1);
  });
});

describe('今日は予定のない習慣', () => {
  it('active で今日が予定日でない習慣を返す', () => {
    expect(unscheduledHabits(habits, TODAY).map((x) => x.id)).toEqual(['weekday']);
  });
});
