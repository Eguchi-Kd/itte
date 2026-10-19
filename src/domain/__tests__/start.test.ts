import { describe, expect, it } from 'vitest';
import { isDomainError } from '../errors';
import {
  ABANDON_MS,
  activeSession,
  findAbandoned,
  remainingMs,
  SESSION_MS,
  sessionState,
  spentMinutes,
  transition,
} from '../start/session';
import { carryOverCandidates, startedOn, todayTask, validateTaskInput } from '../start/tasks';
import type { Session } from '../types';
import { NOW, session, task } from './startFixtures';

const MIN = 60_000;

let n = 0;
const newId = () => `id${++n}`;

describe('やること', () => {
  it('todayTask は今日のうち createdAt が最も古い1件を返し、残りを others に入れる', () => {
    const tasks = [
      task({ id: 'b', createdAt: 2 }),
      task({ id: 'a', createdAt: 1 }),
      task({ id: 'c', createdAt: 3 }),
      task({ id: 'old', createdAt: 0, plannedFor: '2026-10-17' }),
      task({ id: 'done', createdAt: 0, archivedAt: NOW }),
    ];
    const r = todayTask(tasks, '2026-10-18');
    expect(r.task?.id).toBe('a');
    expect(r.others.map((t) => t.id)).toEqual(['b', 'c']);
    expect(todayTask([], '2026-10-18')).toEqual({ task: null, others: [] });
  });

  it('carryOverCandidates は予定日が今日より前で片づけていないもの', () => {
    const tasks = [
      task({ id: 'y', plannedFor: '2026-10-17' }),
      task({ id: 'today' }),
      task({ id: 'closed', plannedFor: '2026-10-10', archivedAt: NOW, closedReason: 'done' }),
      task({ id: 'tomorrow', plannedFor: '2026-10-19' }),
    ];
    expect(carryOverCandidates(tasks, '2026-10-18').map((t) => t.id)).toEqual(['y']);
  });

  it('startedOn はその論理日にセッションが始まったか（4時の境界）', () => {
    const t = task();
    const at = (h: number, d = 19) => new Date(2026, 9, d, h, 0).getTime();
    expect(startedOn(t, [session({ startedAt: at(3) })], '2026-10-18')).toBe(true);
    expect(startedOn(t, [session({ startedAt: at(4) })], '2026-10-18')).toBe(false);
    expect(startedOn(t, [session({ startedAt: at(4), taskId: 'other' })], '2026-10-19')).toBe(false);
  });

  it('validateTaskInput: B 条件は3項目必須、A 条件は title だけ', () => {
    const empty = { title: '序章', roughVersion: '', firstAction: null, plannedFor: '2026-10-18' };
    expect(Object.keys(validateTaskInput(empty, true)).sort()).toEqual(['firstAction', 'roughVersion']);
    expect(validateTaskInput(empty, false)).toEqual({});
    expect(validateTaskInput({ ...empty, title: ' ' }, false)).toEqual({ title: { copyKey: 'errors.required' } });
    expect(validateTaskInput({ ...empty, title: 'あ'.repeat(81) }, false).title).toEqual({ copyKey: 'errors.tooLong', n: 80 });
  });
});

describe('セッションの状態', () => {
  it('remainingMs と状態: running → ending（0:00）→ closed', () => {
    const s = session();
    expect(remainingMs(s, NOW + 3 * MIN + 48_000)).toBe(372_000);
    expect(sessionState(s, NOW + SESSION_MS - 1)).toBe('running');
    expect(sessionState(s, NOW + SESSION_MS)).toBe('ending');
    expect(remainingMs(s, NOW + SESSION_MS + 5000)).toBe(0);
    expect(sessionState(session({ endedAt: NOW + MIN }), NOW + MIN)).toBe('closed');
    expect(remainingMs(session({ endedAt: NOW + MIN }), NOW)).toBe(0);
  });

  it('spentMinutes は閉じていれば終了まで、開いていれば最大10分', () => {
    expect(spentMinutes(session({ endedAt: NOW + 4 * MIN }), NOW + 30 * MIN)).toBe(4);
    expect(spentMinutes(session(), NOW + 30 * MIN)).toBe(10);
    expect(spentMinutes(session(), NOW + 3 * MIN)).toBe(3);
  });
});

describe('transition（§8.4.2）', () => {
  it('始める: running のセッションを作り、タイマーへ', () => {
    const e = transition(null, { type: 'start', taskId: 't9', roughMode: false }, NOW, newId);
    expect(e.create).toMatchObject({ taskId: 't9', startedAt: NOW, endedAt: null, plannedMin: 10, roughMode: false, outcome: null });
    expect(e.goTo).toBe('timer');
  });

  it('詰まった → 埋める／調べる: StuckLog だけを作り、タイマーは止めない', () => {
    for (const choice of ['fill', 'research5'] as const) {
      const e = transition(session(), { type: 'stuck', choice, blocker: '構成' }, NOW + MIN, newId);
      expect(e.stuckLog).toMatchObject({ sessionId: 's1', taskId: 't1', choice, blocker: '構成', at: NOW + MIN });
      expect(e.close).toBeUndefined();
      expect(e.goTo).toBeUndefined();
    }
  });

  it('詰まった → 止める: StuckLog を作り stopped で閉じて終了画面へ', () => {
    const e = transition(session(), { type: 'stuck', choice: 'stop', blocker: '資料' }, NOW + MIN, newId);
    expect(e.stuckLog?.choice).toBe('stop');
    expect(e.close).toEqual({ id: 's1', endedAt: NOW + MIN, outcome: 'stopped' });
    expect(e.goTo).toBe('end');
  });

  it('中断: stopped で閉じて終了画面へ', () => {
    expect(transition(session(), { type: 'interrupt' }, NOW + MIN, newId)).toEqual({
      close: { id: 's1', endedAt: NOW + MIN, outcome: 'stopped' },
      goTo: 'end',
    });
  });

  it('ending から続ける: continued で閉じ、同じやることの新しいセッションを作る', () => {
    const e = transition(session(), { type: 'continue' }, NOW + SESSION_MS, newId);
    expect(e.close).toEqual({ id: 's1', endedAt: NOW + SESSION_MS, outcome: 'continued' });
    expect(e.create).toMatchObject({ taskId: 't1', startedAt: NOW + SESSION_MS, endedAt: null, roughMode: true });
    expect(e.create?.id).not.toBe('s1');
  });

  it('ending からやめる: stopped で閉じ、次の一手を更新してホームへ。閉じた後は次の一手だけ', () => {
    const e = transition(session(), { type: 'stop', nextStep: '見出しを足す' }, NOW + SESSION_MS, newId);
    expect(e).toEqual({
      close: { id: 's1', endedAt: NOW + SESSION_MS, outcome: 'stopped' },
      nextStep: { taskId: 't1', value: '見出しを足す' },
      goTo: 'home',
    });
    const closed = session({ endedAt: NOW + MIN, outcome: 'stopped' });
    expect(transition(closed, { type: 'stop', nextStep: 'x' }, NOW + 2 * MIN, newId)).toEqual({
      nextStep: { taskId: 't1', value: 'x' },
      goTo: 'home',
    });
  });

  it('放置: 開始から40分以上で abandoned（endedAt = 開始＋10分）にし、逃避ログを促す', () => {
    const e = transition(session(), { type: 'abandon' }, NOW + ABANDON_MS, newId);
    expect(e).toEqual({ close: { id: 's1', endedAt: NOW + SESSION_MS, outcome: 'abandoned' }, promptEscape: true });
  });

  it('ありえない遷移は CONFLICT', () => {
    const cases: [Session | null, Parameters<typeof transition>[1], number][] = [
      [null, { type: 'interrupt' }, NOW],
      [session(), { type: 'stuck', choice: 'fill', blocker: 'x' }, NOW + SESSION_MS],
      [session({ endedAt: NOW }), { type: 'interrupt' }, NOW + MIN],
      [session({ endedAt: NOW }), { type: 'continue' }, NOW + MIN],
      [session(), { type: 'abandon' }, NOW + ABANDON_MS - 1],
    ];
    for (const [s, e, at] of cases) {
      let caught: unknown;
      try {
        transition(s, e, at, newId);
      } catch (err) {
        caught = err;
      }
      expect(isDomainError(caught, 'CONFLICT')).toBe(true);
    }
  });
});

describe('放置と進行中', () => {
  it('findAbandoned は未終了で開始から40分以上のもの（境界 40分ちょうどを含む）', () => {
    const list = [
      session({ id: 'a', startedAt: NOW - ABANDON_MS }),
      session({ id: 'b', startedAt: NOW - ABANDON_MS + 1 }),
      session({ id: 'c', startedAt: NOW - 2 * ABANDON_MS, endedAt: NOW - ABANDON_MS }),
      session({ id: 'd', startedAt: NOW - 3 * ABANDON_MS }),
    ];
    expect(findAbandoned(list, NOW).map((s) => s.id)).toEqual(['d', 'a']);
  });

  it('activeSession は開始から10分未満の未終了セッション', () => {
    expect(activeSession([session({ startedAt: NOW - 5 * MIN })], NOW)?.id).toBe('s1');
    expect(activeSession([session({ startedAt: NOW - SESSION_MS })], NOW)).toBeNull();
  });
});
