import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { formatMmSs } from '../../../domain/display';
import { SESSION_MS } from '../../../domain/start/session';
import type { EpochMs, ID } from '../../../domain/types';
import { Button } from '../../components/Button';
import { InterruptCard } from '../../components/InterruptCard';
import { useNow } from '../../hooks/useNow';

/** 再開（割り込みカード1）。「10分タイマーの途中です 残り 6:12」と「戻る」 */
export function ResumeCard({ sessionId, startedAt }: { sessionId: ID; startedAt: EpochMs }) {
  const navigate = useNavigate();
  const now = useNow(1000);
  const remaining = startedAt + SESSION_MS - now;
  return (
    <InterruptCard testId="resume-card">
      <p className="text-body" data-testid="resume-text">
        {remaining > 0 ? fill(ja.today.interrupt.resume, { mmss: formatMmSs(remaining) }) : ja.today.interrupt.resumeEnding}
      </p>
      <Button className="mt-3" onClick={() => navigate(remaining > 0 ? `/session/${sessionId}` : `/session/${sessionId}/end`)}>
        {ja.today.interrupt.back}
      </Button>
    </InterruptCard>
  );
}
