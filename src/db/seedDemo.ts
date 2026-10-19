// 開発用のデモデータ（§7.6 の末尾）。import.meta.env.DEV のときだけ設定画面から投入する。
// 現在のデータを消してから、過去の時刻を now として各リポジトリ関数を古い順に呼ぶ（台帳も通常どおり積む）
import { addDays, dayStart, logicalDate, weekdayOf } from '../domain/dates';
import type { EpochMs, LocalDate } from '../domain/types';
import { wipeAll } from './backup';
import { db } from './db';
import { createMove, decideMove, saveMoveReview } from './repo/board';
import { completeOnboarding } from './repo/common';
import { chooseFollowUp, createChildGoal, createGoal, extendDeadline, judge, saveMetric, syncStallFlags } from './repo/goals';
import { recordDone, recordMissed, saveHabit } from './repo/habits';
import { createTask, endSession, recordStuck, saveDailyCheck, saveEscapeLog, startSession, sweepAbandoned } from './repo/start';
import { ensureSeed } from './seed';

const HOUR = 3_600_000;
const MIN = 60_000;

export async function loadDemoData(now: EpochMs): Promise<void> {
  const today = logicalDate(now);
  /** k 日前の論理日の h 時（4:00 起点の論理日の中の時刻） */
  const at = (k: number, h: number): EpochMs => dayStart(addDays(today, -k)) + (h - 4) * HOUR;
  const day = (k: number): LocalDate => addDays(today, -k);

  await wipeAll();
  await ensureSeed(at(29, 8));
  await completeOnboarding(null, 'optimist', at(29, 8));
  const tags = await db.reasonTags.orderBy('order').toArray();
  const tagId = (i: number) => tags[i]?.id ?? tags[0]?.id ?? '';

  // 習慣2件、28日分の記録。金曜は記録なしが多い
  const reading = await saveHabit(
    {
      kind: 'build',
      name: '読書',
      replacesText: null,
      purpose: '',
      unit: 'ページ',
      amount: 10,
      minAmount: 2,
      schedule: { days: [0, 1, 2, 3, 4, 5, 6], time: '21:00', cue: null },
      place: 'ソファ',
      how: '',
      commitmentNote: null,
      funNote: null,
    },
    at(28, 8),
  );
  const stretch = await saveHabit(
    {
      kind: 'build',
      name: 'ストレッチ',
      replacesText: null,
      purpose: '',
      unit: '分',
      amount: 5,
      minAmount: 1,
      schedule: { days: [1, 2, 3, 4, 5], time: null, cue: '歯みがきのあと' },
      place: '寝室',
      how: '',
      commitmentNote: null,
      funNote: null,
    },
    at(28, 8),
  );
  for (let k = 28; k >= 1; k -= 1) {
    const date = day(k);
    const wd = weekdayOf(date);
    const recordAt = at(k, 22);
    if (wd === 5) {
      await recordMissed(reading.id, date, [tagId(0)], null, recordAt);
      if (k % 2 === 0) await recordMissed(stretch.id, date, [tagId(1)], null, recordAt);
      else await recordDone(stretch.id, date, undefined, recordAt);
      continue;
    }
    if (k % 7 === 3) await recordMissed(reading.id, date, [tagId(1)], null, recordAt);
    else await recordDone(reading.id, date, undefined, recordAt);
    if (wd >= 1 && wd <= 5) {
      if (k % 9 === 0) await recordMissed(stretch.id, date, [], null, recordAt);
      else await recordDone(stretch.id, date, undefined, recordAt);
    }
  }

  // やること3件（終えたセッション、詰まり、放置）
  const t1 = await createTask(
    { title: '確定申告の書類', roughVersion: '領収書を1枚だけ入れる', firstAction: '封筒を机に出す', plannedFor: day(6) },
    true,
    at(6, 19),
  );
  const s1 = await startSession(t1.id, true, null, at(6, 20));
  await endSession(s1.id, 'stop', '残りの領収書を日付順に並べる', null, at(6, 20) + 10 * MIN);

  const t2 = await createTask(
    { title: '発表のスライド', roughVersion: '見出しだけ3枚', firstAction: 'ファイルを開く', plannedFor: day(3) },
    true,
    at(3, 19),
  );
  const s2 = await startSession(t2.id, true, null, at(3, 20));
  await recordStuck(s2.id, '2枚目の図をどう描くか', 'fill', at(3, 20) + 4 * MIN);
  await endSession(s2.id, 'stop', '2枚目は箱を3つ並べるだけにする', null, at(3, 20) + 10 * MIN);

  const t3 = await createTask(
    { title: '部屋の片づけ', roughVersion: '机の上だけ', firstAction: 'ごみ袋を出す', plannedFor: day(2) },
    true,
    at(2, 18),
  );
  const s3 = await startSession(t3.id, true, null, at(2, 21));
  await sweepAbandoned(at(2, 23));
  await saveEscapeLog({ taskId: t3.id, sessionId: s3.id, priorState: 'fatigue', target: 'video', enjoyed: 'partly' }, at(2, 23));
  for (const k of [6, 3, 2, 1]) {
    await saveDailyCheck({ pendingWorry: k !== 1, consumptionMin: 30 + k * 10, plannedTaskExists: k !== 2 }, day(k), at(k, 23));
  }

  // 手5件（感想戦済み3件、うち悪手1件）
  const moves = [
    { k: 12, situation: '週末の予定をどちらに入れるか', cands: ['土曜に引っ越しの下見', '日曜に下見して土曜は休む'], pick: 1 },
    { k: 10, situation: '残業の依頼を受けるか', cands: ['受ける', '半分だけ受ける', '断る'], pick: 1 },
    { k: 8, situation: '古いパソコンを修理するか買い替えるか', cands: ['修理に出す', '買い替える'], pick: 0 },
    { k: 4, situation: '勉強会の発表を引き受けるか', cands: ['引き受ける', '次回にする'], pick: 0 },
    { k: 1, situation: '旅行の宿をいま決めるか', cands: ['いま予約する', '来週まで待つ'], pick: 1 },
  ];
  const decided: string[] = [];
  for (const m of moves) {
    const { move, candidates } = await createMove(
      {
        situation: m.situation,
        triggerId: null,
        irreversible: m.k === 8,
        unreadable: false,
        candidates: m.cands.map((description, i) => ({ description, plus1: null, plus2: null, score: i === m.pick ? 1 : 0 })),
      },
      at(m.k, 12),
    );
    const chosen = candidates[m.pick];
    if (chosen) await decideMove(move.id, chosen.id, at(m.k, 12) + 5 * MIN);
    decided.push(move.id);
  }
  const [m1, m2, m3] = decided;
  if (m1) await saveMoveReview({ moveId: m1, outcome: '下見で候補を1つに絞れた', judgmentOk: true, rating: 'good', blindSpot: null, note: null }, at(7, 20));
  if (m2) await saveMoveReview({ moveId: m2, outcome: '半分でも週末まで延びた', judgmentOk: true, rating: 'neutral', blindSpot: null, note: null }, at(7, 20));
  if (m3) {
    await saveMoveReview(
      { moveId: m3, outcome: '修理代が買い替えの半分を超えた', judgmentOk: false, rating: 'bad', blindSpot: 'reading', note: '見積もりの前に決めた' },
      at(7, 20),
    );
  }

  // 段: 届いて終わった段1本／届かずに2段刻んだ木1本／3回延長して足踏みフラグが立つ段1本
  const weight = await saveMetric(
    { name: '体重', unit: 'kg', direction: 'LOWER_IS_BETTER', collectionMethod: '朝の体重計', verifiable: true },
    at(27, 8),
  );
  const pages = await saveMetric(
    { name: '1週間に読んだページ', unit: 'ページ', direction: 'HIGHER_IS_BETTER', collectionMethod: '読書の記録の合計', verifiable: true },
    at(27, 8),
  );
  const words = await saveMetric(
    { name: '覚えた単語', unit: '語', direction: 'HIGHER_IS_BETTER', collectionMethod: '単語帳アプリの数', verifiable: true },
    at(27, 8),
  );

  const met = await createGoal(
    { metricId: pages.id, title: '1週間で50ページ', targetValue: 50, comparator: 'GTE', deadline: day(14), onMet: '70ページの段を立てる', onUnmet: '30ページに刻む', probability: 0.7, predictedValue: 55 },
    at(21, 9),
  );
  await judge(met.id, 62, null, { enforced: true }, at(13, 9));

  const root = await createGoal(
    { metricId: weight.id, title: '月末に65kg 以下', targetValue: 65, comparator: 'LTE', deadline: day(20), onMet: '64kg の段を立てる', onUnmet: '1週間で0.5kg に刻む', probability: 0.6, predictedValue: 64.8 },
    at(27, 9),
  );
  await judge(root.id, 66.4, { investedHours: 6, costNote: '夜の自由な時間' }, { enforced: true }, at(19, 9));
  await chooseFollowUp(root.id, 'KIZAMI', at(19, 9) + MIN);
  const child = await createChildGoal(
    root.id,
    { metricId: weight.id, title: '1週間で66kg 以下', targetValue: 66, comparator: 'LTE', deadline: day(12), onMet: '65.5kg に進む', onUnmet: '夕食の量だけに刻む', probability: 0.5, predictedValue: 66.1 },
    at(19, 10),
  );
  await judge(child.id, 66.2, { investedHours: 2, costNote: '外食の回数' }, { enforced: true }, at(11, 9));
  await chooseFollowUp(child.id, 'KIZAMI', at(11, 9) + MIN);
  await createChildGoal(
    child.id,
    { metricId: weight.id, title: '10日で66.1kg 以下', targetValue: 66.1, comparator: 'LTE', deadline: addDays(today, 7), onMet: '66kg に進む', onUnmet: '記録だけ続ける', probability: 0.6, predictedValue: 66 },
    at(11, 10),
  );

  const stalled = await createGoal(
    { metricId: words.id, title: '単語を300語', targetValue: 300, comparator: 'GTE', deadline: day(20), onMet: '500語の段を立てる', onUnmet: '1日10語に刻む', probability: 0.8, predictedValue: 310 },
    at(26, 9),
  );
  await extendDeadline(stalled.id, day(14), '出張が入った', day(21), at(21, 9));
  await extendDeadline(stalled.id, day(7), '単語帳を変えた', day(15), at(15, 9));
  await extendDeadline(stalled.id, addDays(today, 5), 'まだ200語ほど', day(8), at(8, 9));
  await syncStallFlags(today, now);
}

