// 簡易記録（§6.7.5）。局面と選んだことの2行。?retro=1 なら「あとから記録」を既定でオン
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { createQuickMove } from '../../../db/repo/board';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useFlags } from '../../hooks/useFlags';

export default function MoveQuick() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { notify } = useFeedback();
  const flags = useFlags();
  const [situation, setSituation] = useState('');
  const [chosenText, setChosenText] = useState('');
  const [retro, setRetro] = useState(params.get('retro') === '1');
  const [busy, setBusy] = useState(false);
  const valid = situation.trim().length > 0 && chosenText.trim().length > 0;

  return (
    <main className="flex flex-col gap-5 px-4 pb-8" data-testid="move-quick">
      <ScreenHeader title={ja.board.move.quickTitle} fallback="/" />
      <TextField label={ja.board.quickSituation} value={situation} onChange={setSituation} maxLength={200} />
      <TextField label={ja.board.quickChosen} value={chosenText} onChange={setChosenText} maxLength={200} />
      <Toggle label={ja.board.retro} checked={retro} onChange={setRetro} testId="retro-toggle" />
      <Button
        size="lg"
        block
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await createQuickMove({ situation, chosenText, retro, phase: flags.preset === 'board' ? flags.phase : null }, Date.now());
            notify({ type: 'moveDecided' });
            navigate('/', { replace: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        {ja.board.move.save}
      </Button>
    </main>
  );
}
