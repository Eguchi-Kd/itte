// 週次ふりかえりのカード（§6.9）。どのカードも、主ボタンでその場で保存して次へ進む
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import type { GoalsData } from '../../../db/queries/goals';
import type { WeeklyData } from '../../../db/queries/review';
import { saveMoveReview } from '../../../db/repo/board';
import { saveCountermeasure, saveWeeklyCheck, setHabitStatus } from '../../../db/repo/habits';
import { activeEvaluation } from '../../../domain/board/board';
import { BLIND_SPOTS, blindSpotStats, bottleneck, moveReviewValid } from '../../../domain/board/moves';
import { addDays, diffDays } from '../../../domain/dates';
import type { Pattern } from '../../../domain/habits/patterns';
import { isFirstWeekOfMonth, weeklyFacts, type WeeklyInput } from '../../../domain/review/weekly';
import type { BlindSpot, ID, LocalDate, Rating, Settings, WeeklyCheck } from '../../../domain/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { LessonShell } from '../../components/LessonShell';
import { ScaleInput } from '../../components/ScaleInput';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { Koma } from '../../mascot/Koma';
import { StallCard, stallCount } from '../goals/StallCard';

export interface CardFrame {
  step: number;
  total: number;
  onClose: () => void;
  /** このカードを終えて次へ進む */
  onNext: () => void;
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <ChipGroup label={label} className="grid grid-cols-2">
      <ChoiceChip selected={value === true} onToggle={() => onChange(true)}>
        {ja.start.yes}
      </ChoiceChip>
      <ChoiceChip selected={value === false} onToggle={() => onChange(false)}>
        {ja.start.no}
      </ChoiceChip>
    </ChipGroup>
  );
}

/** 1 数字: 今週の事実だけ。評価語なし */
export function FactsCard({ frame, input, weekStart }: { frame: CardFrame; input: WeeklyInput; weekStart: LocalDate }) {
  const f = weeklyFacts(input, weekStart);
  return (
    <LessonShell step={frame.step} intro={frame.step === 1 ? 'weekly' : undefined} total={frame.total} title={ja.review.titles.facts} onClose={frame.onClose} primaryLabel={ja.common.next} onPrimary={frame.onNext}>
      <Koma pose="read" />
      <ul className="flex flex-col gap-2 text-body" data-testid="weekly-facts">
        {f.habits.map((h) => (
          <li key={h.habitId}>{fill(ja.review.fact.habitRow, h)}</li>
        ))}
        <li>{fill(ja.review.fact.sessions, { n: f.sessions })}</li>
        <li>{fill(ja.review.fact.stucks, { n: f.stucks })}</li>
        <li>{fill(ja.review.fact.moves, { n: f.moves })}</li>
        <li>{fill(ja.review.fact.judgments, { n: f.judgments })}</li>
        <li>{fill(ja.review.fact.escapes, { n: f.escapes })}</li>
      </ul>
    </LessonShell>
  );
}

const RATINGS: [Rating, string][] = [
  ['good', ja.review.good],
  ['neutral', ja.review.neutral],
  ['bad', ja.review.bad],
];
const BLIND_LABEL: Record<BlindSpot, string> = {
  board: ja.review.board,
  eval: ja.review.eval,
  trigger: ja.review.trigger,
  reading: ja.review.reading,
};

/** 2 感想戦: 「判断は妥当だった?」と「結果は?」を別々に聞く。悪手なら見落としが必須 */
export function MoveReviewCard({ frame, data, moveId }: { frame: CardFrame; data: WeeklyData; moveId: ID }) {
  const move = data.moves.find((m) => m.id === moveId);
  const prev = data.moveReviews.find((r) => r.moveId === moveId);
  const cands = data.candidates.filter((c) => c.moveId === moveId).sort((a, b) => a.position - b.position);
  const [judgmentOk, setJudgmentOk] = useState<boolean | null>(prev?.judgmentOk ?? null);
  const [outcome, setOutcome] = useState(prev?.outcome ?? '');
  const [rating, setRating] = useState<Rating | null>(prev?.rating ?? null);
  const [blindSpot, setBlindSpot] = useState<BlindSpot | null>(prev?.blindSpot ?? null);
  const [note, setNote] = useState(prev?.note ?? '');
  const [promote, setPromote] = useState(false);
  const [principle, setPrinciple] = useState('');
  const [busy, setBusy] = useState(false);
  if (!move) return null;
  const valid = rating !== null && moveReviewValid({ judgmentOk, rating, blindSpot }) && (!promote || principle.trim().length > 0);

  return (
    <LessonShell
      step={frame.step}
      intro={frame.step === 1 ? 'weekly' : undefined}
      total={frame.total}
      title={move.situation}
      onClose={frame.onClose}
      primaryLabel={ja.review.move.save}
      primaryDisabled={!valid || busy}
      onPrimary={async () => {
        if (!rating || judgmentOk === null) return;
        setBusy(true);
        try {
          await saveMoveReview(
            { moveId, outcome, judgmentOk, rating, blindSpot: rating === 'bad' ? blindSpot : null, note, promoteToJoseki: promote ? principle : null },
            Date.now(),
          );
          frame.onNext();
        } finally {
          setBusy(false);
        }
      }}
    >
      <Card data-testid="review-move">
        {move.mode === 'quick' ? (
          <p className="text-body">
            {ja.review.move.chosen}: {move.chosenText}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {cands.map((c) => (
              <li key={c.id} className={`text-body ${c.id === move.chosenCandidateId ? 'font-bold' : ''}`}>
                {c.id === move.chosenCandidateId ? fill(ja.review.move.chosenMark, { text: c.description }) : c.description}
              </li>
            ))}
            {!move.chosenCandidateId && <li className="text-caption text-text-2">{ja.review.move.undecided}</li>}
          </ul>
        )}
      </Card>
      <div className="flex flex-col gap-2">
        <span className="text-label">{ja.review.judgmentOkQ}</span>
        <YesNo label={ja.review.judgmentOkQ} value={judgmentOk} onChange={setJudgmentOk} />
      </div>
      <TextField label={`${ja.review.outcomeQ}${ja.common.optional}`} value={outcome} onChange={setOutcome} maxLength={200} testId="review-outcome" />
      <div className="flex flex-col gap-2">
        <span className="text-label">{ja.review.move.rating}</span>
        <ChipGroup label={ja.review.move.rating}>
          {RATINGS.map(([r, label]) => (
            <ChoiceChip key={r} selected={rating === r} onToggle={() => setRating(r)}>
              {label}
            </ChoiceChip>
          ))}
        </ChipGroup>
      </div>
      {rating === 'bad' && (
        <div className="flex flex-col gap-2">
          <span className="text-label">{ja.review.blindQ}</span>
          <ChipGroup label={ja.review.blindQ}>
            {BLIND_SPOTS.map((b) => (
              <ChoiceChip key={b} selected={blindSpot === b} onToggle={() => setBlindSpot(b)}>
                {BLIND_LABEL[b]}
              </ChoiceChip>
            ))}
          </ChipGroup>
          {!blindSpot && <p className="text-caption">{ja.errors.badNeedsBlindSpot}</p>}
        </div>
      )}
      <TextField label={`${ja.review.move.note}${ja.common.optional}`} value={note} onChange={setNote} maxLength={200} />
      <Toggle label={ja.review.promote} checked={promote} onChange={setPromote} />
      {promote && <TextField label={ja.review.move.principle} value={principle} onChange={setPrinciple} maxLength={100} />}
    </LessonShell>
  );
}

type Decision = 'continue' | 'reduce' | 'end';

/** 3 習慣: 自動化の4問。定期レビューの対象なら有用性・もう一度選ぶか・継続／縮小／終了 */
export function HabitCheckCard({
  frame,
  data,
  habitId,
  weekStart,
  reviewDue,
  graduationEligible,
  onReduce,
}: {
  frame: CardFrame;
  data: WeeklyData;
  habitId: ID;
  weekStart: LocalDate;
  reviewDue: boolean;
  graduationEligible: boolean;
  onReduce: (habitId: ID) => void;
}) {
  const habit = data.habits.find((h) => h.id === habitId);
  const prev = data.checks.find((c) => c.habitId === habitId && c.weekStart === weekStart);
  const [auto, setAuto] = useState<(number | null)[]>(prev ? [...prev.automaticity] : [null, null, null, null]);
  const [useful, setUseful] = useState<number | null>(prev?.habitReview?.stillUseful ?? null);
  const [again, setAgain] = useState<boolean | null>(prev?.habitReview?.wouldChooseAgain ?? null);
  const [decision, setDecision] = useState<Decision | null>(prev?.habitReview?.decision ?? null);
  const [graduate, setGraduate] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!habit) return null;
  const valid = auto.every((v) => v !== null) && (!reviewDue || (useful !== null && again !== null && decision !== null));

  return (
    <LessonShell
      step={frame.step}
      intro={frame.step === 1 ? 'weekly' : undefined}
      total={frame.total}
      title={habit.name}
      onClose={frame.onClose}
      primaryLabel={ja.review.habit.save}
      primaryDisabled={!valid || busy}
      onPrimary={async () => {
        setBusy(true);
        try {
          const now = Date.now();
          const habitReview: WeeklyCheck['habitReview'] =
            reviewDue && useful !== null && again !== null && decision ? { stillUseful: useful, wouldChooseAgain: again, decision } : null;
          await saveWeeklyCheck({ habitId, weekStart, automaticity: auto as WeeklyCheck['automaticity'], habitReview }, now);
          if (graduate && decision !== 'end') await setHabitStatus(habitId, 'graduated', null, now);
          if (decision === 'reduce') onReduce(habitId);
          frame.onNext();
        } finally {
          setBusy(false);
        }
      }}
    >
      {ja.review.autoQ.map((q, i) => (
        <div key={q} className="flex flex-col gap-2">
          <span className="text-label">{q}</span>
          <ScaleInput label={q} value={auto[i]} onChange={(v) => setAuto((a) => a.map((x, j) => (j === i ? v : x)))} />
        </div>
      ))}
      {reviewDue && (
        <Card className="flex flex-col gap-3" data-testid="habit-review">
          {habit.purpose && <p className="text-body">{fill(ja.review.habit.purpose, { purpose: habit.purpose })}</p>}
          <span className="text-label">{ja.review.usefulQ}</span>
          <ScaleInput label={ja.review.usefulQ} value={useful} onChange={setUseful} />
          <span className="text-label">{ja.review.againQ}</span>
          <YesNo label={ja.review.againQ} value={again} onChange={setAgain} />
          <span className="text-label">{ja.review.habit.decisionQ}</span>
          <div role="radiogroup" aria-label={ja.review.habit.decisionQ} className="grid grid-cols-3 gap-2">
            {(
              [
                ['continue', ja.review.keep],
                ['reduce', ja.review.reduce],
                ['end', ja.review.quit],
              ] as const
            ).map(([d, label]) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={decision === d}
                onClick={() => setDecision(d)}
                className={`btn btn-secondary h-12 ${decision === d ? 'border-primary bg-primary-tint' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-right text-caption text-text-2">{ja.review.quitNote}</p>
        </Card>
      )}
      {graduationEligible && <Toggle label={ja.review.habit.graduateQ} checked={graduate} onChange={setGraduate} />}
    </LessonShell>
  );
}

/** 4 傾向と対策: 傾向を件数つきで。各傾向に「この条件への対策」（80文字以内） */
export function PatternCard({ frame, data, habitId, patterns }: { frame: CardFrame; data: WeeklyData; habitId: ID; patterns: Pattern[] }) {
  const habit = data.habits.find((h) => h.id === habitId);
  const existing = data.countermeasures.filter((c) => c.habitId === habitId);
  const [actions, setActions] = useState<Record<string, string>>(
    Object.fromEntries(patterns.map((p) => [p.key, existing.find((c) => c.conditionKey === p.key)?.action ?? ''])),
  );
  const [busy, setBusy] = useState(false);
  if (!habit) return null;
  return (
    <LessonShell
      step={frame.step}
      intro={frame.step === 1 ? 'weekly' : undefined}
      total={frame.total}
      title={habit.name}
      onClose={frame.onClose}
      primaryLabel={ja.review.pattern.save}
      primaryDisabled={busy}
      onPrimary={async () => {
        setBusy(true);
        try {
          const now = Date.now();
          for (const p of patterns) {
            const action = actions[p.key]?.trim();
            if (!action) continue;
            const prev = existing.find((c) => c.conditionKey === p.key);
            await saveCountermeasure({ id: prev?.id, habitId, conditionKey: p.key, conditionLabel: p.label, action }, now);
          }
          frame.onNext();
        } finally {
          setBusy(false);
        }
      }}
    >
      {patterns.map((p) => (
        <Card key={p.key} className="flex flex-col gap-2">
          <p className="text-body" data-testid={`pattern-${p.key}`}>
            {patternLine(p)}
          </p>
          <TextField
            label={ja.review.counter}
            value={actions[p.key] ?? ''}
            onChange={(v) => setActions((a) => ({ ...a, [p.key]: v }))}
            maxLength={80}
          />
        </Card>
      ))}
    </LessonShell>
  );
}

export function patternLine(p: Pattern): string {
  return fill(ja.review.patternLine, { label: p.label, n: p.n, done: Math.round(p.rate * p.n), overall: Math.round(p.overall * 100) });
}

/** 5 足踏み: 規則の説明と、段の情報、「刻む」「切り直す」「段を見る」「却下」 */
export function StallReviewCard({
  frame,
  goalsData,
  settings,
  flagId,
}: {
  frame: CardFrame;
  goalsData: GoalsData;
  settings: Settings;
  flagId: ID;
}) {
  const navigate = useNavigate();
  const flag = goalsData.stallFlags.find((f) => f.id === flagId);
  const goal = flag ? goalsData.goals.find((g) => g.id === flag.goalId) : undefined;
  return (
    <LessonShell step={frame.step} intro={frame.step === 1 ? 'weekly' : undefined} total={frame.total} title={ja.review.titles.stalls} onClose={frame.onClose} primaryLabel={ja.common.next} onPrimary={frame.onNext}>
      {flag && goal && (
        <StallCard
          flag={flag}
          goal={goal}
          n={stallCount(flag, goalsData, settings, Date.now())}
          extra={
            goal.status === 'UNMET' && (
              <>
                <Button variant="secondary" onClick={() => navigate(`/goals/${goal.id}/kizami`)}>
                  {ja.goals.kizami}
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/goals/${goal.id}/recut`)}>
                  {ja.goals.recut}
                </Button>
              </>
            )
          }
        />
      )}
    </LessonShell>
  );
}

/** 6 しめ: 感想戦の集計（数値のみ）、いちばん多い見落とし、評価関数の残り日数、月の最初の週なら見直し */
export function CloseCard({
  frame,
  data,
  weekStart,
  today,
  busy,
  onFinish,
}: {
  frame: CardFrame;
  data: WeeklyData;
  weekStart: LocalDate;
  today: LocalDate;
  busy: boolean;
  onFinish: () => void;
}) {
  const navigate = useNavigate();
  const stats = blindSpotStats(data.moves, data.moveReviews, weekStart, addDays(weekStart, 6));
  const top = bottleneck(stats.byBlindSpot);
  const ef = activeEvaluation(data.efs, today);
  return (
    <LessonShell
      step={frame.step}
      intro={frame.step === 1 ? 'weekly' : undefined}
      total={frame.total}
      title={ja.review.titles.close}
      onClose={frame.onClose}
      primaryLabel={ja.review.close.finish}
      primaryDisabled={busy}
      onPrimary={onFinish}
    >
      <Card className="flex flex-col gap-1" data-testid="weekly-close">
        {stats.total === 0 ? (
          <p className="text-body">{ja.review.close.noMoves}</p>
        ) : (
          <>
            <p className="text-body">
              {fill(ja.review.close.badRate, { r: Math.round((stats.badRate ?? 0) * 100), total: stats.total, bad: stats.bad })}
            </p>
            {BLIND_SPOTS.map((b) => (
              <p key={b} className="text-caption text-text-2">
                {fill(ja.review.close.blindRow, { label: BLIND_LABEL[b], n: stats.byBlindSpot[b] })}
              </p>
            ))}
          </>
        )}
        {top && <p className="mt-2 text-body">{fill(ja.review.bottleneck, { label: ja.review.conditions[top] })}</p>}
        {ef && <p className="mt-2 text-body">{fill(ja.review.close.evalLeft, { n: diffDays(ef.endDate, today) })}</p>}
      </Card>
      {isFirstWeekOfMonth(weekStart) && (
        <Button variant="secondary" onClick={() => navigate('/settings/evaluation')}>
          {ja.review.reviewEval}
        </Button>
      )}
    </LessonShell>
  );
}
