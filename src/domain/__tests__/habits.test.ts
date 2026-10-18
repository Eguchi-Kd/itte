import { describe, expect, it } from 'vitest';
import { addDays, dayStart, weekdayOf } from '../dates';
import { automaticityScore, graduationEligible } from '../habits/automaticity';
import { formatDays, formatIntention, formatTime } from '../habits/formatIntention';
import { levelUpSuggestion, smallStartSuggestion } from '../habits/guards';
import { detectPatterns, reasonBreakdown } from '../habits/patterns';
import { pendingReasonPrompts } from '../habits/reasons';
import { reviewDue, reviewInterval } from '../habits/review';
import { isScheduled, scheduledDates } from '../habits/schedule';
import { cumulativeAmount, doneRatio, weekCount, weeklySeries } from '../habits/stats';
import { check, habit, log, logsBy, TODAY } from './habitFixtures';

describe('予定日', () => {
  it('AC-HAB-01: isScheduled が曜日を扱う', () => {
    const h = habit({ schedule: { days: [1, 3, 5], time: null, cue: '朝食のあと' } });
    expect(isScheduled(h, '2026-10-19')).toBe(true); // 月
    expect(isScheduled(h, '2026-10-20')).toBe(false); // 火
    expect(isScheduled(h, '2026-10-21')).toBe(true); // 水
    expect(isScheduled(h, '2026-10-18')).toBe(false); // 日
  });

  it('AC-HAB-01: isScheduled が開始日と終了日を両端を含めて扱う', () => {
    const h = habit({ startedOn: '2026-10-10', endedOn: '2026-10-15' });
    expect(isScheduled(h, '2026-10-09')).toBe(false);
    expect(isScheduled(h, '2026-10-10')).toBe(true);
    expect(isScheduled(h, '2026-10-15')).toBe(true);
    expect(isScheduled(h, '2026-10-16')).toBe(false);
    expect(isScheduled(habit({ startedOn: '2026-10-10', endedOn: null }), '2027-03-01')).toBe(true);
  });

  it('AC-HAB-01: scheduledDates は期間内の予定日を古い順に返す', () => {
    const h = habit({ schedule: { days: [0, 6], time: '09:00', cue: null }, startedOn: '2026-10-04' });
    expect(scheduledDates(h, '2026-10-01', '2026-10-18')).toEqual([
      '2026-10-04',
      '2026-10-10',
      '2026-10-11',
      '2026-10-17',
      '2026-10-18',
    ]);
  });
});

describe('統計', () => {
  const h = habit({ startedOn: '2026-10-12' });

  it('AC-HAB-02: 今日が予定日で記録がない場合、今日を分母に入れない', () => {
    const logs = [log('2026-10-12'), log('2026-10-13'), log('2026-10-14', false)];
    // 10/12〜10/17 の6日 ＋ 今日（記録なし）は数えない
    expect(doneRatio(h, logs, '2026-10-12', TODAY, TODAY)).toEqual({ rate: 2 / 6, done: 2, scheduled: 6 });
  });

  it('AC-HAB-02: 今日に記録があれば分母に入れる（記録なしの記録でも入れる）', () => {
    expect(doneRatio(h, [log('2026-10-12'), log(TODAY)], '2026-10-12', TODAY, TODAY)).toEqual({
      rate: 2 / 7,
      done: 2,
      scheduled: 7,
    });
    expect(doneRatio(h, [log(TODAY, false)], '2026-10-12', TODAY, TODAY).scheduled).toBe(7);
  });

  it('AC-HAB-02: 予定日が0なら rate は null', () => {
    const sundayOnly = habit({ schedule: { days: [0], time: null, cue: 'x' }, startedOn: TODAY });
    expect(doneRatio(sundayOnly, [], TODAY, TODAY, TODAY)).toEqual({ rate: null, done: 0, scheduled: 0 });
  });

  it('累積量は done=true の量の合計で、予定外の日も含む', () => {
    const weekdays = habit({ schedule: { days: [1, 2, 3, 4, 5], time: null, cue: 'x' } });
    const logs = [
      log('2026-10-16', true, { amount: 30 }),
      log('2026-10-17', true, { amount: 25 }), // 土曜（予定外）
      log('2026-10-15', false),
      log('2026-10-14', true, { amount: 99, habitId: 'other' }),
    ];
    expect(cumulativeAmount(weekdays, logs)).toBe(55);
  });

  it('weeklySeries は12週を古い順に、回数・予定回数・量で返す', () => {
    const logs = [log('2026-10-12', true, { amount: 5 }), log('2026-10-13', true, { amount: 7 }), log('2026-10-05')];
    const s = weeklySeries(habit({ startedOn: '2026-10-01' }), logs, TODAY);
    expect(s).toHaveLength(12);
    expect(s[11]).toEqual({ weekStart: '2026-10-12', doneCount: 2, scheduledCount: 7, amount: 12 });
    expect(s[10]).toEqual({ weekStart: '2026-10-05', doneCount: 1, scheduledCount: 7, amount: 10 });
    expect(s[9].weekStart).toBe('2026-09-28');
    expect(s[9].scheduledCount).toBe(4); // 10/01 開始
    expect(s[0].scheduledCount).toBe(0);
  });

  it('weekCount は今週の予定回数と、予定日に記録した回数', () => {
    const h3 = habit({ schedule: { days: [1, 3, 5], time: null, cue: 'x' } });
    expect(weekCount(h3, [log('2026-10-12'), log('2026-10-14', false), log('2026-10-17')], TODAY)).toEqual({
      done: 1,
      scheduled: 3,
    });
  });
});

describe('理由の促し', () => {
  it('AC-HAB-05: today-3〜today-1 の未記録の予定日を古い順に返す', () => {
    const a = habit({ id: 'a' });
    const b = habit({ id: 'b', schedule: { days: [5, 6], time: null, cue: 'x' } }); // 金土
    const ended = habit({ id: 'c', status: 'ended' });
    const logs = [log('2026-10-16', true, { habitId: 'a' }), log('2026-10-17', false, { habitId: 'b' })];
    expect(pendingReasonPrompts([a, b, ended], logs, TODAY)).toEqual([
      { habitId: 'a', date: '2026-10-15' },
      { habitId: 'b', date: '2026-10-16' },
      { habitId: 'a', date: '2026-10-17' },
    ]);
  });

  it('AC-HAB-05: 今日と4日前は含めない。開始前の日も含めない', () => {
    const h = habit({ startedOn: '2026-10-16' });
    expect(pendingReasonPrompts([h], [], TODAY).map((p) => p.date)).toEqual(['2026-10-16', '2026-10-17']);
    expect(pendingReasonPrompts([habit()], [], TODAY).map((p) => p.date)).toEqual([
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
    ]);
  });
});

describe('傾向', () => {
  const weekdaysOnly = { days: [1, 2, 3, 4, 5], time: null, cue: 'x' };

  function weeksBack(n: number): string {
    // 先週の金曜（10/16）で終わる n 週ぶんの月曜
    return addDays('2026-10-12', -7 * (n - 1));
  }

  it('AC-HAB-06: n=7 では返さず、n=8 で返す（差は大きい）', () => {
    for (const [weeks, expected] of [
      [7, []],
      [8, ['weekday:5']],
    ] as const) {
      const start = weeksBack(weeks);
      const h = habit({ schedule: weekdaysOnly, startedOn: start });
      const logs = logsBy(start, '2026-10-17', (d) => weekdayOf(d) !== 5);
      const result = detectPatterns(h, logs, TODAY);
      expect(result.map((r) => r.key)).toEqual(expected);
    }
    const h8 = habit({ schedule: weekdaysOnly, startedOn: weeksBack(8) });
    const r8 = detectPatterns(h8, logsBy(weeksBack(8), '2026-10-17', (d) => weekdayOf(d) !== 5), TODAY);
    expect(r8[0]).toEqual({ key: 'weekday:5', label: '金曜日', rate: 0, n: 8, overall: 0.8 });
  });

  it('AC-HAB-06: 全体との差 0.20 は返し、0.19 は返さない', () => {
    const start = weeksBack(20);
    const h = habit({ schedule: weekdaysOnly, startedOn: start });
    const weekIndex = (d: string) => Math.floor((dayStart(d) - dayStart(start)) / (7 * 86400000));
    // 金曜は偶数週だけ（10/20）。月曜はすべて記録なし。0.19 のときは最初の火曜も記録なし
    const build = (extraMiss: boolean) =>
      logsBy(start, '2026-10-17', (d) => {
        const wd = weekdayOf(d);
        if (wd === 5) return weekIndex(d) % 2 === 0;
        if (wd === 1) return false;
        if (extraMiss && d === addDays(start, 1)) return false;
        return true;
      });

    const at20 = detectPatterns(h, build(false), TODAY);
    const fri20 = at20.find((r) => r.key === 'weekday:5');
    expect(fri20).toMatchObject({ rate: 0.5, n: 20 });
    expect(fri20?.overall).toBeCloseTo(0.7, 10);

    const at19 = detectPatterns(h, build(true), TODAY);
    expect(at19.find((r) => r.key === 'weekday:5')).toBeUndefined();
    expect(at19.find((r) => r.key === 'weekday:1')?.overall).toBeCloseTo(0.69, 10);
  });

  it('AC-HAB-06: 差の大きい順に最大3件を返し、全体より高い条件は返さない', () => {
    const start = '2026-08-10'; // 月曜から10週
    const h = habit({ startedOn: start });
    const doneCount: Record<number, number> = { 0: 1, 5: 2, 4: 3 };
    const seen: Record<number, number> = {};
    const logs = logsBy(start, '2026-10-17', (d) => {
      const wd = weekdayOf(d);
      if (wd === 6) return false;
      if (wd in doneCount) {
        seen[wd] = (seen[wd] ?? 0) + 1;
        return seen[wd] <= doneCount[wd];
      }
      return true;
    });
    const result = detectPatterns(h, logs, TODAY);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.key)).toEqual(['weekday:6', 'weekday:0', 'weekday:5']);
    const diffs = result.map((r) => r.overall - r.rate);
    expect([...diffs].sort((a, b) => b - a)).toEqual(diffs);
    expect(result.every((r) => r.rate < r.overall)).toBe(true);
  });

  it('前の予定日が記録なしだった日の条件を数える', () => {
    const start = '2026-08-03'; // 11週
    const h = habit({ startedOn: start, schedule: { days: [1, 3], time: null, cue: 'x' } });
    // 月曜は全部記録なし、水曜は全部やった → 水曜の条件は全体より高い、prevMissed は水曜（直前の月曜が記録なし）
    const logs = logsBy(start, '2026-10-17', (d) => weekdayOf(d) === 3);
    const result = detectPatterns(h, logs, TODAY);
    expect(result.map((r) => r.key)).toEqual(['weekday:1']);
    const allMissed = detectPatterns(h, [], TODAY);
    expect(allMissed).toEqual([]);
  });

  it('reasonBreakdown は記録なしの理由タグ別の件数を降順で返す', () => {
    const logs = [
      log('2026-10-10', false, { reasonTagIds: ['t1'] }),
      log('2026-10-11', false, { reasonTagIds: ['t2', 't1'] }),
      log('2026-10-12', false, { reasonTagIds: ['t1'] }),
      log('2026-10-13', true, { reasonTagIds: ['t2'] }),
      log('2026-10-14', false, { reasonTagIds: ['t3'], habitId: 'x' }),
    ];
    expect(reasonBreakdown(habit(), logs, TODAY)).toEqual([
      { tagId: 't1', count: 3 },
      { tagId: 't2', count: 1 },
    ]);
  });
});

describe('ガード', () => {
  it('AC-HAB-09: smallStartSuggestion の倍率は既定 2', () => {
    expect(smallStartSuggestion(10, 4, null)).toBe(4); // 10 > 8
    expect(smallStartSuggestion(10, 5, null)).toBeNull(); // 10 > 10 ではない
    expect(smallStartSuggestion(10, 5, 'regret')).toBeNull();
    expect(smallStartSuggestion(11, 5, 'optimist')).toBe(5);
  });

  it('AC-HAB-09: selfblame では倍率 1.5', () => {
    expect(smallStartSuggestion(10, 6, 'selfblame')).toBe(6); // 10 > 9
    expect(smallStartSuggestion(9, 6, 'selfblame')).toBeNull(); // 9 > 9 ではない
    expect(smallStartSuggestion(10, 6, null)).toBeNull(); // 既定なら 10 > 12 ではない
  });

  const daily = (p: Partial<Parameters<typeof habit>[0]> = {}) =>
    habit({ startedOn: '2026-09-01', amountChangedOn: '2026-10-04', amount: 10, ...p });
  const last13 = logsBy('2026-10-05', '2026-10-17', () => true);

  it('AC-HAB-10: 3条件を満たすと §8.2.3 の式の値', () => {
    expect(levelUpSuggestion(daily(), last13, TODAY)).toBe(12); // min(20, max(11, 12))
    expect(levelUpSuggestion(daily({ amount: 1 }), last13, TODAY)).toBe(2); // min(2, max(2, 2))
    expect(levelUpSuggestion(daily({ amount: 3 }), last13, TODAY)).toBe(4); // min(6, max(4, 4))
    expect(levelUpSuggestion(daily({ amount: 100 }), last13, TODAY)).toBe(120); // min(200, max(101, 120))
  });

  it('AC-HAB-10: 直近14日の rate が 0.9 未満なら null（0.9 ちょうどは満たす）', () => {
    const missTwo = last13.filter((l) => l.date !== '2026-10-06' && l.date !== '2026-10-07');
    expect(levelUpSuggestion(daily(), missTwo, TODAY)).toBeNull(); // 11/13
    // 平日だけの習慣: 10/05〜10/16 の10日のうち9日
    const wd = daily({ schedule: { days: [1, 2, 3, 4, 5], time: null, cue: 'x' } });
    const nine = logsBy('2026-10-05', '2026-10-16', (d) => weekdayOf(d) !== 0 && weekdayOf(d) !== 6 && d !== '2026-10-07');
    expect(levelUpSuggestion(wd, nine, TODAY)).toBe(12);
  });

  it('AC-HAB-10: 予定日が4未満なら null', () => {
    const sundays = daily({ schedule: { days: [0], time: null, cue: 'x' } });
    expect(levelUpSuggestion(sundays, [log('2026-10-11')], TODAY)).toBeNull(); // 予定日は 10/11 だけ（今日は記録なし）
    const four = daily({ schedule: { days: [0, 6], time: null, cue: 'x' } });
    // 10/10・10/11・10/17 の3日（今日は記録なしで分母に入らない）。割合は 1.0 でも予定日が足りない
    expect(levelUpSuggestion(four, [log('2026-10-10'), log('2026-10-11'), log('2026-10-17')], TODAY)).toBeNull();
    const logs = [log('2026-10-10'), log('2026-10-11'), log('2026-10-17'), log(TODAY)];
    expect(levelUpSuggestion(four, logs, TODAY)).toBe(12);
  });

  it('AC-HAB-10: 量を変えてから14日たっていなければ null', () => {
    expect(levelUpSuggestion(daily({ amountChangedOn: '2026-10-05' }), last13, TODAY)).toBeNull();
  });
});

describe('自動化と卒業', () => {
  const started = (startedOn: string) => habit({ startedOn, schedule: { days: [1, 2, 3, 4, 5], time: null, cue: 'x' } });
  const good = [check('2026-09-28', [4, 4, 4, 4]), check('2026-10-05', [5, 4, 4, 4]), check('2026-10-12', [4, 5, 4, 4])];
  // 9/21〜10/16 の平日20日のうち16日（0.8）
  const sixteen = logsBy('2026-09-21', '2026-10-17', (d) => {
    const wd = weekdayOf(d);
    return wd >= 1 && wd <= 5 && !['2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'].includes(d);
  });

  it('automaticityScore は4問の平均で丸めない', () => {
    expect(automaticityScore({ automaticity: [4, 4, 4, 3] })).toBe(3.75);
  });

  it('AC-HAB-11: 3条件を満たすと true（56日、スコア4.0、割合0.8 のちょうどを含む）', () => {
    expect(graduationEligible(started('2026-08-23'), sixteen, good, TODAY)).toBe(true);
  });

  it('AC-HAB-11: 開始から56日未満なら false', () => {
    expect(graduationEligible(started('2026-08-24'), sixteen, good, TODAY)).toBe(false);
  });

  it('AC-HAB-11: 直近3回のどれかが4.0未満、または3回に満たないと false。古い回は見ない', () => {
    const low = [...good.slice(0, 2), check('2026-10-12', [4, 4, 4, 3])];
    expect(graduationEligible(started('2026-08-23'), sixteen, low, TODAY)).toBe(false);
    expect(graduationEligible(started('2026-08-23'), sixteen, good.slice(1), TODAY)).toBe(false);
    const withOldLow = [check('2026-09-21', [1, 1, 1, 1]), ...good];
    expect(graduationEligible(started('2026-08-23'), sixteen, withOldLow, TODAY)).toBe(true);
  });

  it('AC-HAB-11: 直近28日の割合が0.8未満なら false', () => {
    const fifteen = sixteen.filter((l) => l.date !== '2026-10-14');
    expect(graduationEligible(started('2026-08-23'), fifteen, good, TODAY)).toBe(false);
  });
});

describe('定期レビュー', () => {
  it('AC-HAB-12: 間隔は既定28日、meaning で14日', () => {
    expect(reviewInterval(null)).toBe(28);
    expect(reviewInterval('regret')).toBe(28);
    expect(reviewInterval('meaning')).toBe(14);
  });

  it('AC-HAB-12: 開始から間隔以上たち、直近にレビューがなければ true', () => {
    expect(reviewDue(habit({ startedOn: '2026-09-20' }), [], TODAY, null)).toBe(true); // 28日
    expect(reviewDue(habit({ startedOn: '2026-09-21' }), [], TODAY, null)).toBe(false); // 27日
    expect(reviewDue(habit({ startedOn: '2026-10-04' }), [], TODAY, 'meaning')).toBe(true); // 14日
    expect(reviewDue(habit({ startedOn: '2026-10-05' }), [], TODAY, 'meaning')).toBe(false); // 13日
    expect(reviewDue(habit({ startedOn: '2026-10-04' }), [], TODAY, null)).toBe(false);
  });

  it('AC-HAB-12: habitReview 付きの週次チェックが直近の間隔内にあれば false', () => {
    const h = habit({ startedOn: '2026-08-01' });
    const reviewed = (date: string) =>
      check('2026-09-21', [3, 3, 3, 3], {
        answeredAt: dayStart(date) + 3600_000,
        habitReview: { stillUseful: 4, wouldChooseAgain: true, decision: 'continue' },
      });
    expect(reviewDue(h, [reviewed('2026-09-22')], TODAY, null)).toBe(false); // 26日前
    expect(reviewDue(h, [reviewed('2026-09-20')], TODAY, null)).toBe(true); // 28日前
    expect(reviewDue(h, [check('2026-10-12', [3, 3, 3, 3])], TODAY, null)).toBe(true); // habitReview なし
    expect(reviewDue(h, [reviewed('2026-10-01')], TODAY, 'meaning')).toBe(true); // 17日前、間隔14日
  });
});

describe('実行意図の1文', () => {
  it('AC-HAB-13: 平日、07:00、机、タイマーを使って、英単語、10、分', () => {
    expect(
      formatIntention({
        kind: 'build',
        name: '英単語',
        replacesText: null,
        unit: '分',
        amount: 10,
        schedule: { days: [1, 2, 3, 4, 5], time: '07:00', cue: null },
        place: '机',
        how: 'タイマーを使って',
      }),
    ).toBe('平日の7:00に、机で、タイマーを使って英単語を10分');
  });

  it('AC-HAB-13: 月水金、cue=夕食のあと、リビング、how 空、ストレッチ、5、回', () => {
    expect(
      formatIntention({
        kind: 'build',
        name: 'ストレッチ',
        replacesText: null,
        unit: '回',
        amount: 5,
        schedule: { days: [5, 1, 3], time: null, cue: '夕食のあと' },
        place: 'リビング',
        how: '',
      }),
    ).toBe('月・水・金曜の夕食のあとに、リビングで、ストレッチを5回');
  });

  it('AC-HAB-13: 毎日、cue=ベッドに入る前、寝室、replace=スマホを見る、読書、2、ページ', () => {
    expect(
      formatIntention({
        kind: 'replace',
        name: '読書',
        replacesText: 'スマホを見る',
        unit: 'ページ',
        amount: 2,
        schedule: { days: [0, 1, 2, 3, 4, 5, 6], time: null, cue: 'ベッドに入る前' },
        place: '寝室',
        how: '',
      }),
    ).toBe('スマホを見るの代わりに、毎日のベッドに入る前に、寝室で、読書を2ページ');
  });

  it('曜日と時刻の書き方', () => {
    expect(formatDays([0, 6])).toBe('土日');
    expect(formatDays([0, 1])).toBe('月・日曜');
    expect(formatDays([2])).toBe('火曜');
    expect(formatTime('21:30')).toBe('21:30');
    expect(formatTime('07:05')).toBe('7:05');
  });
});
