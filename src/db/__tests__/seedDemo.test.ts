import { beforeEach, describe, expect, it } from 'vitest';
import { weekdayOf } from '../../domain/dates';
import { checkIntegrity } from '../backup';
import { db } from '../db';
import { loadDemoData } from '../seedDemo';
import { NOW, resetSeeded } from './helpers';

beforeEach(async () => {
  await resetSeeded();
});

describe('デモデータ（§7.6）', () => {
  it('習慣2件（28日分、金曜は記録なしが多い）、やること3件、手5件（感想戦3件、悪手1件）、段の3つの形を作り、台帳は整合する', async () => {
    await loadDemoData(NOW);

    expect(await db.habits.count()).toBe(2);
    const logs = await db.habitLogs.toArray();
    const dates = new Set(logs.map((l) => l.date));
    expect(dates.size).toBe(28);
    const missRate = (fri: boolean) => {
      const xs = logs.filter((l) => (weekdayOf(l.date) === 5) === fri);
      return xs.filter((l) => !l.done).length / xs.length;
    };
    expect(missRate(true)).toBeGreaterThan(missRate(false));

    expect(await db.tasks.count()).toBe(3);
    const sessions = await db.sessions.toArray();
    expect(sessions.map((s) => s.outcome).sort()).toEqual(['abandoned', 'stopped', 'stopped']);
    expect(await db.stuckLogs.count()).toBe(1);

    expect(await db.moves.count()).toBe(5);
    const reviews = await db.moveReviews.toArray();
    expect(reviews).toHaveLength(3);
    expect(reviews.filter((r) => r.rating === 'bad')).toHaveLength(1);

    const goals = await db.goals.toArray();
    expect(goals.filter((g) => g.status === 'MET')).toHaveLength(1);
    const unmet = goals.filter((g) => g.status === 'UNMET');
    expect(unmet).toHaveLength(2);
    expect(goals.filter((g) => g.parentId !== null)).toHaveLength(2);
    expect(await db.goalFollowUps.count()).toBe(2);
    expect(await db.deadlineExtensions.count()).toBe(3);
    expect((await db.stallFlags.toArray()).some((f) => f.dismissedAt === null)).toBe(true);

    expect((await db.settings.get('singleton'))?.onboarded).toBe(true);
    const r = await checkIntegrity();
    expect(r.ok).toBe(true);
  });
});
