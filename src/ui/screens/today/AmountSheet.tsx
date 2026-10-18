import { useState } from 'react';
import { ja } from '../../../copy/ja';
import type { Habit } from '../../../domain/types';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { NumberStepper } from '../../components/NumberStepper';

interface Props {
  habit: Habit | null;
  onClose: () => void;
  onRecord: (amount: number) => void;
}

/** 「やった」の長押し: 量を入れて記録する */
export function AmountSheet({ habit, onClose, onRecord }: Props) {
  return (
    <BottomSheet open={habit !== null} onClose={onClose} title={ja.today.node.amountTitle}>
      {habit && <AmountForm key={habit.id} habit={habit} onRecord={onRecord} />}
    </BottomSheet>
  );
}

function AmountForm({ habit, onRecord }: { habit: Habit; onRecord: (amount: number) => void }) {
  const [amount, setAmount] = useState<number | null>(habit.amount);
  return (
    <div className="flex flex-col gap-4 pb-2">
      <NumberStepper
        label={habit.name}
        value={amount}
        onChange={setAmount}
        min={1}
        unit={habit.unit}
        decrementLabel={ja.common.decrement}
        incrementLabel={ja.common.increment}
      />
      <Button size="lg" block disabled={!amount || amount < 1} onClick={() => amount && onRecord(amount)}>
        {ja.today.node.amountRecord}
      </Button>
    </div>
  );
}
