import type { ReactNode } from 'react';
import { ja } from '../../copy/ja';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onFix: () => void;
}

/** 「確かめる → 確定する」の2段目に出るボトムシート（§5.8）。取り消せない操作にだけ使う */
export function CheckSheet({ open, title, children, confirmLabel = ja.common.confirm, busy = false, onConfirm, onFix }: Props) {
  return (
    <BottomSheet open={open} onClose={onFix} title={title} testId="check-sheet">
      <div className="flex flex-col gap-3 pb-2">
        {children}
        <Button size="lg" block disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button size="lg" block variant="secondary" onClick={onFix}>
          {ja.common.fix}
        </Button>
      </div>
    </BottomSheet>
  );
}
