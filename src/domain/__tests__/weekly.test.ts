import { describe, expect, it } from 'vitest';
import { blindSpotStats, bottleneck, movesInWeek, moveReviewValid } from '../board/moves';
import { buildWeeklyCards, isFirstWeekOfMonth, weeklyFacts, type WeeklyInput } from '../review/weekly';
import type { Move, MoveReview, StallFlag } from '../types';
import { habit, log, TODAY } from './habitFixtures';

const NOW = new Date(2026, 9, 18, 12, 0).getTime();
const at = (d: number, h = 12, mi = 0) => new Date(2026, 9, d, h, mi).getTime();

function move(id: string, createdAt: number, p: Partial<Move> = {}): Move {
  return {
    id,
    triggerId: null,
    situation: id,
    mode: 'full',
    retro: false,
    irreversible: false,
    unreadable: false,
    chosenCandidateId: null,
    chosenText: null,
    decidedAt: null,
    phase: null,
    createdAt,
    ...p,
  };
}

function review(moveId: string, rating: MoveReview['rating'], blindSpot: MoveReview['blindSpot'] = null): MoveReview {
  return { id: `r-${moveId}`, moveId, outcome: null, judgmentOk: true, rating, blindSpot, note: null, reviewedAt: NOW };
}

function input(p: Partial<WeeklyInput> = {}): WeeklyInput {
  return {
    habits: [],
    habitLogs: [],
    checks: [],
    sessions: [],
    stuckLogs: [],
    escapeLogs: [],
    moves: [],
    judgments: [],
    stallFlags: [],
    persona: null,
    ...p,
  };
}

describe('週次ふりかえりのカード', () => {
  it('AC-REV-02: §6.9 の区画順（数字 → 感想戦 → 習慣 → 傾向と対策 → 足踏み → しめ）にカードを並べる', () => {
    const h = habit({ id: 'h', startedOn: '2026-08-01', schedule: { days: [1, 2, 3, 4, 5], time: null, cue: 'x' } });
    // 金曜だけ記録なし → 傾向が出る
    const logs = [];
    for (let d = new Date(2026, 7, 3); d < new Date(2026, 9, 17); d.setDate(d.getDate() + 1)) {
      const wd = d.getDay();
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (wd >= 1 && wd <= 4) logs.push(log(s, true, { habitId: 'h' }));
    }
    const flag: StallFlag = { id: 'f', goalId: 'g', rule: 'EXTENSION_3X', detectedAt: NOW, dismissedAt: null };
    const cards = buildWeeklyCards(
      input({ habits: [h], habitLogs: logs, moves: [move('m2', at(14)), move('m1', at(13))], stallFlags: [flag] }),
      '2026-10-12',
      TODAY,
    );
    expect(cards.map((c) => c.key)).toEqual(['facts', 'move:m1', 'move:m2', 'habit:h', 'pattern:h', 'stall:f', 'close']);
    expect(cards.map((c) => c.section)).toEqual(['facts', 'moves', 'moves', 'habits', 'patterns', 'stalls', 'close']);
  });

  it('AC-REV-02: 対象のない区画は省く（数字としめは常に出す）', () => {
    expect(buildWeeklyCards(input(), '2026-10-12', TODAY).map((c) => c.key)).toEqual(['facts', 'close']);
    const ended = habit({ id: 'e', status: 'ended' });
    const future = habit({ id: 'f', startedOn: '2026-10-19' });
    const dismissed: StallFlag = { id: 'x', goalId: 'g', rule: 'EXTENSION_3X', detectedAt: NOW, dismissedAt: NOW };
    const other = move('old', at(11)); // 前の週の日曜
    const cards = buildWeeklyCards(input({ habits: [ended, future], stallFlags: [dismissed], moves: [other] }), '2026-10-12', TODAY);
    expect(cards.map((c) => c.key)).toEqual(['facts', 'close']);
  });

  it('習慣のカードは定期レビューと定着の条件を持つ', () => {
    const h = habit({ id: 'h', startedOn: '2026-08-01' });
    const cards = buildWeeklyCards(input({ habits: [h] }), '2026-10-12', TODAY);
    expect(cards[1]).toMatchObject({ section: 'habits', habitId: 'h', reviewDue: true, graduationEligible: false });
  });

  it('数字カード: 習慣ごとの done/scheduled、セッション・詰まり・手・判定・逃避ログの件数', () => {
    const h = habit({ id: 'h', startedOn: '2026-10-01', schedule: { days: [1, 3, 5], time: null, cue: 'x' } });
    const facts = weeklyFacts(
      input({
        habits: [h],
        habitLogs: [log('2026-10-12', true, { habitId: 'h' }), log('2026-10-14', false, { habitId: 'h' })],
        sessions: [
          { id: 's1', taskId: 't', startedAt: at(13), endedAt: null, plannedMin: 10, outcome: null, roughMode: true, affectPredictionId: null },
          { id: 's2', taskId: 't', startedAt: at(19, 3), endedAt: null, plannedMin: 10, outcome: null, roughMode: true, affectPredictionId: null },
        ],
        stuckLogs: [{ id: 'k', sessionId: 's1', taskId: 't', at: at(13), blocker: 'x', choice: 'fill' }],
        escapeLogs: [{ id: 'e', at: at(12, 3), taskId: null, sessionId: null, priorState: null, target: null, enjoyed: null }],
        moves: [move('m', at(15))],
      }),
      '2026-10-12',
    );
    expect(facts).toEqual({
      habits: [{ habitId: 'h', name: '英単語', done: 1, scheduled: 3 }],
      sessions: 2, // 10/19 03:00 は論理日 10/18
      stucks: 1,
      moves: 1,
      judgments: 0,
      escapes: 0, // 10/12 03:00 は論理日 10/11（前の週）
    });
  });

  it('月の最初の週', () => {
    expect(isFirstWeekOfMonth('2026-11-02')).toBe(true);
    expect(isFirstWeekOfMonth('2026-10-12')).toBe(false);
  });
});

describe('感想戦', () => {
  it('AC-BOARD-19: 感想戦の対象週の境界が月曜4:00（論理日）である', () => {
    const moves = [
      move('mon0359', at(12, 3, 59)), // 論理日 10/11 → 前の週
      move('mon0400', at(12, 4, 0)), // 論理日 10/12 → この週
      move('sun2359', at(18, 23, 59)), // 論理日 10/18 → この週
      move('mon19_0359', at(19, 3, 59)), // 論理日 10/18 → この週
      move('mon19_0400', at(19, 4, 0)), // 論理日 10/19 → 次の週
    ];
    expect(movesInWeek(moves, '2026-10-12').map((m) => m.id)).toEqual(['mon0400', 'sun2359', 'mon19_0359']);
    expect(movesInWeek(moves, '2026-10-05').map((m) => m.id)).toEqual(['mon0359']);
  });

  it('AC-BOARD-18: blindSpotStats と bottleneck が固定データで手計算と一致する', () => {
    const moves = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => move(id, at(12 + i)));
    const outside = move('z', at(5));
    const reviews = [
      review('a', 'bad', 'reading'),
      review('b', 'bad', 'reading'),
      review('c', 'bad', 'board'),
      review('d', 'good'),
      review('e', 'neutral'),
      review('z', 'bad', 'eval'), // 期間外
    ];
    // f は感想戦なし → 数えない
    const s = blindSpotStats([...moves, outside], reviews, '2026-10-12', '2026-10-18');
    expect(s).toEqual({ total: 5, bad: 3, badRate: 0.6, byBlindSpot: { board: 1, eval: 0, trigger: 0, reading: 2 } });
    expect(bottleneck(s.byBlindSpot)).toBe('reading');
    expect(bottleneck({ board: 1, eval: 0, trigger: 0, reading: 1 })).toBeNull(); // 同数1位
    expect(bottleneck({ board: 0, eval: 0, trigger: 0, reading: 0 })).toBeNull();
    expect(blindSpotStats([], [], '2026-10-12', '2026-10-18')).toEqual({
      total: 0,
      bad: 0,
      badRate: null,
      byBlindSpot: { board: 0, eval: 0, trigger: 0, reading: 0 },
    });
  });

  it('AC-BOARD-15: 悪手のときは見落としを選ばないと保存できず、判断の妥当さは別の入力', () => {
    expect(moveReviewValid({ judgmentOk: true, rating: 'bad', blindSpot: null })).toBe(false);
    expect(moveReviewValid({ judgmentOk: true, rating: 'bad', blindSpot: 'reading' })).toBe(true);
    expect(moveReviewValid({ judgmentOk: null, rating: 'good', blindSpot: null })).toBe(false);
    expect(moveReviewValid({ judgmentOk: false, rating: 'good', blindSpot: null })).toBe(true);
  });
});
