// 読みシート（§6.7.4、4ステップのレッスン）。全ステップの上部に有効な評価関数の指標を出す
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryBoardData, queryJoseki } from '../../../db/queries/board';
import { createMove, decideMove } from '../../../db/repo/board';
import { activeEvaluation } from '../../../domain/board/board';
import { filledCandidates, MAX_CANDIDATES, MIN_CANDIDATES, type CandidateInput } from '../../../domain/board/moves';
import { logicalDate } from '../../../domain/dates';
import type { Candidate, ID } from '../../../domain/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { LessonShell } from '../../components/LessonShell';
import { ScoreInput } from '../../components/ScoreInput';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useFlags } from '../../hooks/useFlags';

const TOTAL = 4;
const MAX_JOSEKI = 5;
const emptyCandidate = (): CandidateInput => ({ description: '', plus1: null, plus2: null, score: null });

export default function MoveNew() {
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const flags = useFlags();
  const board = useLiveQuery(() => queryBoardData(), []);
  const joseki = useLiveQuery(() => queryJoseki(), []);
  const [step, setStep] = useState(1);
  const [situation, setSituation] = useState('');
  const [triggerId, setTriggerId] = useState<ID | null>(null);
  const [cands, setCands] = useState<CandidateInput[]>([emptyCandidate(), emptyCandidate()]);
  const [irreversible, setIrreversible] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [saved, setSaved] = useState<{ moveId: ID; candidates: Candidate[] } | null>(null);
  const [chosen, setChosen] = useState<ID | null>(null);
  const [busy, setBusy] = useState(false);
  if (!board || !joseki) return null;

  const ef = activeEvaluation(board.efs, logicalDate(Date.now()));
  const metric = ef?.metric ?? ja.board.evalQ;
  const band = ef ? fill(ja.board.move.band, { metric: ef.metric }) : undefined;
  const triggers = board.triggers.filter((t) => t.active);
  const filled = filledCandidates(cands).length;
  const setCand = (i: number, patch: Partial<CandidateInput>) => setCands((list) => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const valid =
    step === 1
      ? situation.trim().length > 0
      : step === 2
        ? filled >= MIN_CANDIDATES
        : step === 3
          ? true
          : chosen !== null;

  const onPrimary = async () => {
    if (step < 3) return setStep(step + 1);
    setBusy(true);
    try {
      if (step === 3) {
        // ステップ3を終えた時点で手と候補を保存する
        const { move, candidates } = await createMove(
          { situation, triggerId, irreversible, unreadable, candidates: cands, phase: flags.preset === 'board' ? flags.phase : null },
          Date.now(),
        );
        setSaved({ moveId: move.id, candidates });
        setStep(4);
      } else if (saved && chosen) {
        await decideMove(saved.moveId, chosen, Date.now());
        notify({ type: 'moveDecided' });
        navigate('/', { replace: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const title = step === 1 ? ja.board.situationQ : step === 2 ? ja.board.candidatesQ : step === 3 ? ja.board.irreversibleQ : ja.board.chooseQ;

  return (
    <LessonShell
      step={step}
      total={TOTAL}
      title={title}
      band={band}
      onClose={() => navigate('/', { replace: true })}
      dirty={!saved && (situation.length > 0 || filled > 0)}
      primaryLabel={step === 4 ? ja.board.chooseThis : ja.common.next}
      primaryDisabled={!valid || busy}
      onPrimary={() => void onPrimary()}
      footer={
        step === 4 ? (
          <Button size="lg" block variant="ghost" onClick={() => (notify({ type: 'saved' }), navigate('/', { replace: true }))}>
            {ja.board.decideLater}
          </Button>
        ) : undefined
      }
    >
      {step === 1 && (
        <>
          <TextField label={ja.board.situationQ} value={situation} onChange={setSituation} maxLength={200} testId="move-situation" />
          <div className="flex flex-col gap-2">
            <span className="text-label">{ja.board.move.triggerQ}</span>
            <ChipGroup label={ja.board.move.triggerQ}>
              {triggers.map((t) => (
                <ChoiceChip key={t.id} selected={triggerId === t.id} onToggle={() => setTriggerId(t.id)}>
                  {t.conditionText}
                </ChoiceChip>
              ))}
              <ChoiceChip selected={triggerId === null} onToggle={() => setTriggerId(null)}>
                {ja.board.move.outside}
              </ChoiceChip>
            </ChipGroup>
          </div>
        </>
      )}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          {cands.map((c, i) => (
            <CandidateCard key={i} n={i + 1} value={c} metric={metric} onChange={(p) => setCand(i, p)} />
          ))}
          {cands.length < MAX_CANDIDATES && (
            <Button variant="secondary" onClick={() => setCands((l) => [...l, emptyCandidate()])}>
              {ja.board.addCandidate}
            </Button>
          )}
        </div>
      )}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <Toggle label={ja.board.irreversible} checked={irreversible} onChange={setIrreversible} />
          {irreversible && (
            <Card className="bg-surface-2" data-testid="hold-warning">
              <p className="text-body">{ja.board.holdWarning}</p>
            </Card>
          )}
          <Toggle label={ja.board.unreadable} checked={unreadable} onChange={setUnreadable} />
          {unreadable && (
            <Card data-testid="joseki-cards">
              <p className="mb-2 text-label">{ja.board.move.josekiTitle}</p>
              <ul className="flex flex-col gap-1">
                {joseki
                  .filter((j) => !j.archived)
                  .slice(0, MAX_JOSEKI)
                  .map((j) => (
                    <li key={j.id} className="text-body">
                      {j.principle}
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </div>
      )}
      {step === 4 && saved && (
        <div role="radiogroup" aria-label={ja.board.chooseQ} className="flex flex-col gap-2">
          {saved.candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={chosen === c.id}
              onClick={() => setChosen(c.id)}
              className={`card min-h-14 p-4 text-left text-body ${chosen === c.id ? 'border-primary bg-primary-tint' : ''}`}
            >
              {c.description}
            </button>
          ))}
        </div>
      )}
    </LessonShell>
  );
}

function CandidateCard({
  n,
  value,
  metric,
  onChange,
}: {
  n: number;
  value: CandidateInput;
  metric: string;
  onChange: (p: Partial<CandidateInput>) => void;
}) {
  return (
    <Card className="flex flex-col gap-3" data-testid={`candidate-${n}`}>
      <TextField
        label={fill(ja.board.move.candidate, { n })}
        value={value.description}
        onChange={(v) => onChange({ description: v })}
        maxLength={200}
      />
      <details>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-1 text-label text-text-2">
          {ja.board.readAhead}
          <ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" />
        </summary>
        <div className="flex flex-col gap-3 pt-2">
          <TextField label={ja.board.plus1} value={value.plus1 ?? ''} onChange={(v) => onChange({ plus1: v })} maxLength={200} />
          <TextField label={ja.board.plus2} value={value.plus2 ?? ''} onChange={(v) => onChange({ plus2: v })} maxLength={200} />
          <span className="text-label">{fill(ja.board.score, { metric })}</span>
          <ScoreInput label={fill(ja.board.score, { metric })} value={value.score} onChange={(score) => onChange({ score })} />
        </div>
      </details>
    </Card>
  );
}
