// 段の詳細と木（§6.8.2）。段の削除はない。最上位の段以外は非表示にできる
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryGoalsData } from '../../../db/queries/goals';
import { hideGoal, unhideGoal } from '../../../db/repo/goals';
import { dueLabel } from '../../../domain/board/board';
import { diffDays, logicalDate } from '../../../domain/dates';
import { formatDateShort } from '../../../domain/display';
import { buildTree, depth, rootOf } from '../../../domain/goals/tree';
import type { AffectPredictionValue, OutcomePredictionValue } from '../../../domain/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNow } from '../../hooks/useNow';
import { useSettings } from '../../hooks/useSettings';
import { goalSentence } from './GoalLesson';
import { GoalTree, STATUS_LABEL } from './GoalTree';
import { StallCard, stallCount } from './StallCard';

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <Card data-testid={testId}>
      <h2 className="mb-2 text-h2">{title}</h2>
      {children}
    </Card>
  );
}

export default function GoalDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const settings = useSettings();
  const data = useLiveQuery(() => queryGoalsData(), []);
  if (!data || !settings) return null;
  const goal = data.goals.find((g) => g.id === id);
  const metric = goal ? data.metrics.find((m) => m.id === goal.metricId) : undefined;
  if (!goal || !metric) {
    return (
      <main className="flex flex-col gap-4 px-4">
        <ScreenHeader title={ja.goals.list.title} fallback="/library/goals" />
        <p className="text-body">{ja.goals.notFound}</p>
      </main>
    );
  }
  const today = logicalDate(now);
  const byId = new Map(data.goals.map((g) => [g.id, g]));
  const root = rootOf(goal, byId);
  const familyIds = new Set(data.goals.filter((g) => rootOf(g, byId).id === root.id).map((g) => g.id));
  const tree = buildTree(data.goals.filter((g) => familyIds.has(g.id)));
  const commitments = data.commitments.filter((c) => c.goalId === goal.id);
  const predictions = data.predictions.filter((p) => p.goalId === goal.id).sort((a, b) => a.predictedAt - b.predictedAt);
  const measurements = data.measurements.filter((m) => m.metricId === metric.id).sort((a, b) => b.measuredAt - a.measuredAt);
  const extensions = data.extensions.filter((e) => e.goalId === goal.id).sort((a, b) => a.createdAt - b.createdAt);
  const flags = data.stallFlags.filter((f) => f.goalId === goal.id && f.dismissedAt === null);
  const judgment = data.judgments.find((j) => j.goalId === goal.id) ?? null;
  const corrections = judgment ? data.corrections.filter((c) => c.judgmentId === judgment.id).sort((a, b) => a.createdAt - b.createdAt) : [];
  const followUp = data.followUps.find((f) => f.goalId === goal.id) ?? null;
  const pending = goal.status === 'OPEN' && goal.deadline < today;
  const canExtend = goal.status === 'OPEN' && today <= goal.deadline;
  const canFollow = goal.status === 'UNMET' && followUp?.choice !== 'WITHDRAW';
  const isRoot = goal.parentId === null;
  const d = depth(goal, byId);

  return (
    <main className="flex flex-col gap-3 px-4 pb-8" data-testid="goal-detail">
      <ScreenHeader title={goal.title} fallback="/library/goals" />
      <Card>
        <p className="text-h2">{goalSentence(metric, goal.comparator, goal.targetValue)}</p>
        <p className="mt-1 text-body text-text-2" data-testid="goal-status">
          {ja.goals.detail.status}: {STATUS_LABEL[goal.status]}
          {goal.status === 'OPEN' && ` ${formatDateShort(goal.deadline)} ${dueLabel(diffDays(goal.deadline, today))}`}
        </p>
        {d > 5 && <p className="mt-1 text-caption text-text-2">{fill(ja.goals.distance, { n: d })}</p>}
      </Card>

      <div className="flex flex-wrap gap-2">
        {pending && (
          <Button size="lg" onClick={() => navigate(`/judge/${goal.id}`)}>
            {ja.goals.detail.judgeAction}
          </Button>
        )}
        {canExtend && (
          <Button size="lg" variant="secondary" onClick={() => navigate(`/goals/${goal.id}/extend`)}>
            {ja.goals.extend}
          </Button>
        )}
        {canFollow && (
          <>
            <Button size="lg" variant="secondary" onClick={() => navigate(`/goals/${goal.id}/kizami`)}>
              {ja.goals.kizami}
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate(`/goals/${goal.id}/recut`)}>
              {ja.goals.recut}
            </Button>
          </>
        )}
      </div>

      <Section title={ja.goals.detail.tree}>
        <GoalTree roots={tree} currentId={goal.id} />
      </Section>

      <Section title={ja.goals.detail.commitments}>
        {commitments.map((c) => (
          <div key={c.id} className="mb-2 last:mb-0">
            <p className="text-caption text-text-2">{c.condition === 'ON_MET' ? ja.goals.judge.commitMet : ja.goals.judge.commitUnmet}</p>
            <p className="text-body">{c.nextAction}</p>
          </div>
        ))}
      </Section>

      {predictions.length > 0 && (
        <Section title={ja.goals.detail.prediction}>
          <ul>
            {predictions.map((p) => (
              <li key={p.id} className="text-body">
                {p.kind === 'OUTCOME'
                  ? fill(ja.goals.detail.predictionLine, {
                      p: (p.value as OutcomePredictionValue).probability,
                      value: (p.value as OutcomePredictionValue).value,
                      unit: metric.unit,
                    })
                  : `${ja.start.affectQ} ${(p.value as AffectPredictionValue).intensity}`}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {measurements.length > 0 && (
        <Section title={ja.goals.detail.measurements}>
          <ul>
            {measurements.slice(0, 20).map((m) => (
              <li key={m.id} className="text-body">
                {fill(ja.goals.detail.measurementRow, { date: formatDateShort(logicalDate(m.measuredAt)), value: m.value, unit: metric.unit })}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {extensions.length > 0 && (
        <Section title={ja.goals.detail.extensions}>
          <ul>
            {extensions.map((e) => (
              <li key={e.id} className="text-body">
                {fill(ja.goals.detail.extensionRow, { from: formatDateShort(e.previousDeadline), to: formatDateShort(e.newDeadline), reason: e.reason })}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {flags.length > 0 && (
        <section className="flex flex-col gap-2" aria-label={ja.goals.detail.stalls}>
          {flags.map((f) => (
            <StallCard key={f.id} flag={f} goal={goal} n={stallCount(f, data, settings, now)} />
          ))}
        </section>
      )}

      {judgment && (
        <Section title={ja.goals.detail.judgment} testId="goal-judgment">
          <p className="text-body">
            {fill(ja.goals.detail.judgmentRow, {
              date: formatDateShort(logicalDate(judgment.judgedAt)),
              outcome: judgment.outcome === 'MET' ? ja.goals.met : ja.goals.unmet,
              value: judgment.actualValue,
              unit: metric.unit,
            })}
          </p>
          {corrections.length > 0 && (
            <>
              <p className="mt-2 text-caption text-text-2">{ja.goals.detail.corrections}</p>
              <ul>
                {corrections.map((c) => (
                  <li key={c.id} className="text-body">
                    {fill(ja.goals.detail.correctionRow, {
                      date: formatDateShort(logicalDate(c.createdAt)),
                      field: ja.goals.detail.fields[c.field],
                      value: c.newValue,
                      reason: c.reason,
                    })}
                  </li>
                ))}
              </ul>
            </>
          )}
          {followUp && (
            <p className="mt-2 text-body">
              {ja.goals.detail.followUp}: {ja.goals.followChoice[followUp.choice]}
            </p>
          )}
        </Section>
      )}

      {!isRoot && (
        <Button
          variant="ghost"
          onClick={() => void (goal.hiddenAt === null ? hideGoal(goal.id, Date.now()) : unhideGoal(goal.id))}
        >
          {goal.hiddenAt === null ? ja.goals.hide : ja.goals.detail.unhide}
        </Button>
      )}
    </main>
  );
}
