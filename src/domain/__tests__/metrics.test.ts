import { describe, expect, it } from 'vitest';
import type { DailyCheck, EscapeLog, Session, StuckLog } from '../types';
import {
  badRate,
  driftByWorry,
  escapeBreakdown,
  escapeRecordRate,
  extensionRate,
  kizamiRate,
  measurementRate,
  median,
  noStuckContinueRate,
  retroCountByWeek,
  startRate,
  stuckContinueRate,
  usageRate,
  weeklyReviewCompletionRate,
} from '../verify/metrics';
import { goal, judgment } from './goalFixtures';
import { session, task } from './startFixtures';

const DAY = 86_400_000;
const at = (d: number, h = 12, mi = 0) => new Date(2026, 9, d, h, mi).getTime();

function stuck(p: Partial<StuckLog>): StuckLog {
  return { id: 'k', sessionId: 's1', taskId: 't1', at: at(18), blocker: 'x', choice: 'fill', ...p };
}
function escape(p: Partial<EscapeLog>): EscapeLog {
  return { id: 'e', at: at(18), taskId: null, sessionId: null, priorState: null, target: null, enjoyed: null, ...p };
}
function daily(date: string, pendingWorry: boolean, consumptionMin: number): DailyCheck {
  return { date, pendingWorry, consumptionMin, plannedTaskExists: true, answeredAt: 0 };
}

describe('startRate', () => {
  it('AC-START-14: 「やること×予定日」の組のうち、その論理日にセッションがある組の割合', () => {
    const tasks = [task({ id: 'a', plannedFor: '2026-10-12' }), task({ id: 'b', plannedFor: '2026-10-13' }), task({ id: 'c', plannedFor: '2026-10-14' })];
    const sessions: Session[] = [
      session({ id: 's1', taskId: 'a', startedAt: at(12, 9) }),
      session({ id: 's2', taskId: 'a', startedAt: at(12, 10) }), // 同じ組の2件目は数えない
      session({ id: 's3', taskId: 'b', startedAt: at(14, 3, 59) }), // 論理日 10/13 → 着手
      session({ id: 's4', taskId: 'c', startedAt: at(15, 3, 59) }), // 論理日 10/14 → 着手
    ];
    expect(startRate(tasks, sessions, '2026-10-12', '2026-10-18')).toEqual({ value: 1, n: 3, d: 3 });
  });

  it('AC-START-14: 4:00 の境界をまたいだセッションは翌日の着手で、期間外の予定日は数えない', () => {
    const tasks = [task({ id: 'a', plannedFor: '2026-10-12' }), task({ id: 'b', plannedFor: '2026-10-19' })];
    const sessions = [session({ taskId: 'a', startedAt: at(13, 4, 0) })]; // 論理日 10/13
    expect(startRate(tasks, sessions, '2026-10-12', '2026-10-18')).toEqual({ value: 0, n: 0, d: 1 });
    expect(startRate([], [], '2026-10-12', '2026-10-18')).toEqual({ value: null, n: 0, d: 0 });
  });

  it('AC-START-11: 持ち越したやることは、元の日付を「着手なし」として数える', () => {
    // 10/16 に予定 → 着手せず → 10/18 に持ち越して着手
    const moved = task({ id: 'a', plannedFor: '2026-10-18', planHistory: ['2026-10-16'] });
    const sessions = [session({ taskId: 'a', startedAt: at(18) })];
    expect(startRate([moved], sessions, '2026-10-12', '2026-10-18')).toEqual({ value: 0.5, n: 1, d: 2 });
    // 持ち越し先が期間外なら、元の日付の組だけ
    expect(startRate([moved], sessions, '2026-10-12', '2026-10-17')).toEqual({ value: 0, n: 0, d: 1 });
  });
});

describe('stuckContinueRate', () => {
  const s1 = session({ id: 's1', taskId: 't1', startedAt: at(18, 10), endedAt: at(18, 10, 10), outcome: 'continued' });
  it('AC-START-14: fill／research5 は、そのセッションが abandoned でなければ続けたとする', () => {
    const abandoned = session({ id: 's2', taskId: 't1', startedAt: at(18, 11), endedAt: at(18, 11, 10), outcome: 'abandoned' });
    const logs = [stuck({ id: 'a', sessionId: 's1', choice: 'fill' }), stuck({ id: 'b', sessionId: 's2', choice: 'research5' })];
    expect(stuckContinueRate(logs, [s1, abandoned])).toEqual({ value: 0.5, n: 1, d: 2 });
  });

  it('AC-START-14: stop は、同じやることの新しいセッションが10分以内（境界の10分ちょうどを含む）に始まれば続けたとする', () => {
    const stop = stuck({ id: 'c', sessionId: 's1', choice: 'stop', at: at(18, 10, 5) });
    const within = session({ id: 'n1', taskId: 't1', startedAt: at(18, 10, 15) }); // ちょうど10分後
    const late = session({ id: 'n2', taskId: 't1', startedAt: at(18, 10, 15) + 1 });
    const otherTask = session({ id: 'n3', taskId: 'other', startedAt: at(18, 10, 6) });
    expect(stuckContinueRate([stop], [s1, within])).toEqual({ value: 1, n: 1, d: 1 });
    expect(stuckContinueRate([stop], [s1, late])).toEqual({ value: 0, n: 0, d: 1 });
    expect(stuckContinueRate([stop], [s1, otherTask])).toEqual({ value: 0, n: 0, d: 1 });
  });

  it('AC-START-14: 詰まりがなければ null', () => {
    expect(stuckContinueRate([], [s1])).toEqual({ value: null, n: 0, d: 0 });
  });
});

describe('noStuckContinueRate', () => {
  it('AC-START-14: 詰まりなしで10分未満で止めたか放置で終わったセッションのうち、10分以内に再開した割合', () => {
    const stopped = session({ id: 'a', taskId: 't1', startedAt: at(18, 10), endedAt: at(18, 10, 4), outcome: 'stopped' });
    const resumed = session({ id: 'b', taskId: 't1', startedAt: at(18, 10, 14) }); // ちょうど10分後
    const abandoned = session({ id: 'c', taskId: 't2', startedAt: at(18, 8), endedAt: at(18, 8, 10), outcome: 'abandoned' });
    expect(noStuckContinueRate([], [stopped, resumed, abandoned])).toEqual({ value: 0.5, n: 1, d: 2 });
  });

  it('AC-START-14: 10分で終わった stopped、continued、詰まりのあるセッションは数えない', () => {
    const full = session({ id: 'a', taskId: 't1', startedAt: at(18, 10), endedAt: at(18, 10, 10), outcome: 'stopped' });
    const cont = session({ id: 'b', taskId: 't1', startedAt: at(18, 10, 10), endedAt: at(18, 10, 20), outcome: 'continued' });
    const withStuck = session({ id: 'c', taskId: 't1', startedAt: at(18, 11), endedAt: at(18, 11, 3), outcome: 'stopped' });
    expect(noStuckContinueRate([stuck({ sessionId: 'c' })], [full, cont, withStuck])).toEqual({ value: null, n: 0, d: 0 });
  });

  it('AC-START-14: 再開が10分を過ぎていれば続けたとしない', () => {
    const stopped = session({ id: 'a', taskId: 't1', startedAt: at(18, 10), endedAt: at(18, 10, 4), outcome: 'stopped' });
    const late = session({ id: 'b', taskId: 't1', startedAt: at(18, 10, 14) + 1 });
    expect(noStuckContinueRate([], [stopped, late])).toEqual({ value: 0, n: 0, d: 1 });
  });
});

describe('escapeRecordRate と escapeBreakdown', () => {
  const ab = (id: string) => session({ id, outcome: 'abandoned', endedAt: at(18) });
  it('AC-START-14: abandoned のセッションのうち、逃避ログがあるものの割合', () => {
    expect(escapeRecordRate([ab('a'), ab('b'), ab('c'), ab('d')], [escape({ sessionId: 'a' }), escape({ sessionId: 'c' }), escape({ sessionId: null })])).toEqual({
      value: 0.5,
      n: 2,
      d: 4,
    });
  });

  it('AC-START-14: abandoned 以外のセッションと、関係のない逃避ログは数えない', () => {
    const stopped = session({ id: 'x', outcome: 'stopped', endedAt: at(18) });
    expect(escapeRecordRate([stopped, ab('a')], [escape({ sessionId: 'x' })])).toEqual({ value: 0, n: 0, d: 1 });
  });

  it('AC-START-14: abandoned が0件なら null', () => {
    expect(escapeRecordRate([], [escape({})])).toEqual({ value: null, n: 0, d: 0 });
  });

  it('priorState 別・enjoyed 別の件数。未記入は none に数える', () => {
    const b = escapeBreakdown([escape({ priorState: 'anxiety', enjoyed: 'no' }), escape({ priorState: 'anxiety' }), escape({ enjoyed: 'yes' })]);
    expect(b).toEqual({
      total: 3,
      priorState: { anxiety: 2, fatigue: 0, ambiguity: 0, boredom: 0, none: 1 },
      enjoyed: { yes: 1, no: 1, partly: 0, none: 1 },
    });
  });
});

describe('driftByWorry', () => {
  it('AC-START-14: 気がかりの有無別の消費時間の中央値と件数（奇数件）', () => {
    const r = driftByWorry([daily('a', true, 120), daily('b', true, 30), daily('c', true, 60), daily('d', false, 10)]);
    expect(r).toEqual({ worry: { median: 60, n: 3 }, noWorry: { median: 10, n: 1 } });
  });

  it('AC-START-14: 偶数件は中央の2つの平均', () => {
    const r = driftByWorry([daily('a', false, 0), daily('b', false, 1440), daily('c', false, 30), daily('d', false, 90)]);
    expect(r.noWorry).toEqual({ median: 60, n: 4 });
  });

  it('AC-START-14: 片方が0件なら中央値は null', () => {
    expect(driftByWorry([daily('a', true, 30)])).toEqual({ worry: { median: 30, n: 1 }, noWorry: { median: null, n: 0 } });
    expect(median([])).toBeNull();
  });
});

describe('盤面と段の指標', () => {
  const move = (id: string, createdAt: number, retro = false) => ({
    id,
    triggerId: null,
    situation: id,
    mode: 'quick' as const,
    retro,
    irreversible: false,
    unreadable: false,
    chosenCandidateId: null,
    chosenText: 'x',
    decidedAt: createdAt,
    phase: null,
    createdAt,
  });

  it('badRate・retroCountByWeek・weeklyReviewCompletionRate', () => {
    const moves = [move('a', at(13)), move('b', at(14), true), move('c', at(6), true)];
    const reviews = [
      { id: 'r1', moveId: 'a', outcome: null, judgmentOk: true, rating: 'bad' as const, blindSpot: 'board' as const, note: null, reviewedAt: 0 },
      { id: 'r2', moveId: 'b', outcome: null, judgmentOk: true, rating: 'good' as const, blindSpot: null, note: null, reviewedAt: 0 },
    ];
    expect(badRate(moves, reviews, '2026-10-12', '2026-10-18')).toEqual({ value: 0.5, n: 1, d: 2 });
    expect(retroCountByWeek(moves, '2026-10-05', '2026-10-18')).toEqual([
      { weekStart: '2026-10-05', count: 1 },
      { weekStart: '2026-10-12', count: 1 },
    ]);
    const runs = [{ id: 'w', weekStart: '2026-10-05', startedAt: 0, completedAt: 1, cursor: 0 }];
    expect(weeklyReviewCompletionRate(runs, '2026-10-05', '2026-10-18')).toEqual({ value: 0.5, n: 1, d: 2 });
  });

  it('extensionRate・kizamiRate・measurementRate・usageRate', () => {
    const NOW = at(18);
    expect(extensionRate([], [])).toEqual({ value: null, n: 0, d: 0 });
    const g = goal({ id: 'u', status: 'UNMET', createdAt: NOW - 60 * DAY, deadline: '2026-09-15' });
    const child = goal({ id: 'c', parentId: 'u', createdAt: NOW - 40 * DAY });
    const j = judgment({ goalId: 'u', judgedAt: NOW - 45 * DAY });
    expect(kizamiRate([g, child], [j], [], NOW)).toEqual({ value: 1, n: 1, d: 1 });
    expect(kizamiRate([g], [j], [], NOW)).toEqual({ value: 0, n: 0, d: 1 });
    expect(kizamiRate([g], [judgment({ goalId: 'u', judgedAt: NOW - 29 * DAY })], [], NOW)).toEqual({ value: null, n: 0, d: 0 });
    const m = { id: 'x', metricId: g.metricId, value: 1, measuredAt: NOW - 50 * DAY, source: 'manual' as const, note: null, createdAt: 0 };
    expect(measurementRate([g], [m], [j])).toEqual({ value: 1, n: 1, d: 1 });
    expect(measurementRate([g], [{ ...m, source: 'judgment' }], [j])).toEqual({ value: 0, n: 0, d: 1 });
    expect(usageRate([{ date: '2026-10-12', firstAt: 0 }, { date: '2026-10-14', firstAt: 0 }, { date: '2026-10-30', firstAt: 0 }], '2026-10-12', '2026-10-18')).toEqual({
      value: 2 / 7,
      n: 2,
      d: 7,
    });
  });
});
