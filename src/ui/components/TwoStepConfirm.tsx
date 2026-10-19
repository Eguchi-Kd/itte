import { useState } from 'react';
import { ja } from '../../copy/ja';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
}

/** 全削除用（§5.8）。1段目で説明のシート、2段目で「削除」と入力させる */
export function TwoStepConfirm({ open, onClose, onConfirm, busy = false }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [word, setWord] = useState('');
  const close = () => {
    setStep(1);
    setWord('');
    onClose();
  };
  return (
    <BottomSheet open={open} onClose={close} title={ja.settings.wipe} testId="wipe-confirm">
      {step === 1 ? (
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-body">{ja.settings.wipeIntro}</p>
          <Button size="lg" block variant="danger" onClick={() => setStep(2)}>
            {ja.settings.wipeNext}
          </Button>
          <Button size="lg" block variant="secondary" onClick={close}>
            {ja.common.cancel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <label className="flex flex-col gap-1">
            <span className="text-label">{ja.settings.wipeConfirm}</span>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              className="h-12 rounded-2xl border-2 border-border bg-surface-2 px-3 text-body"
              data-testid="wipe-word"
            />
          </label>
          <Button size="lg" block variant="danger" disabled={word.trim() !== ja.settings.wipeWord || busy} onClick={onConfirm}>
            {ja.settings.wipeExecute}
          </Button>
          <Button size="lg" block variant="secondary" onClick={close}>
            {ja.common.cancel}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
