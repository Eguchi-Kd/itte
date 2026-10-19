import { useState } from 'react';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { formatDateShort } from '../../../domain/display';
import type { Task } from '../../../domain/types';
import { Button } from '../../components/Button';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { InterruptCard } from '../../components/InterruptCard';

interface Props {
  tasks: Task[];
  onMove: (task: Task) => void;
  onClose: (task: Task, reason: 'done' | 'dropped') => void;
  onLater: () => void;
}

/** 持ち越し（割り込みカード3、D29）。1件ずつ「今日に移す」か「片づける」 */
export function CarryCard({ tasks, onMove, onClose, onLater }: Props) {
  const [closing, setClosing] = useState(false);
  const task = tasks[0];
  return (
    <InterruptCard onLater={onLater} testId="carry-card">
      <p className="pr-14 text-body">{fill(ja.today.interrupt.carryTitle, { n: tasks.length })}</p>
      <p className="mt-2 text-h2" data-testid="carry-title">
        {task.title}
      </p>
      <p className="text-caption text-text-2">{formatDateShort(task.plannedFor)}</p>
      {closing ? (
        <ChipGroup label={ja.start.detail.closeQ} className="mt-3">
          <ChoiceChip selected={false} onToggle={() => (setClosing(false), onClose(task, 'done'))}>
            {ja.start.closeDone}
          </ChoiceChip>
          <ChoiceChip selected={false} onToggle={() => (setClosing(false), onClose(task, 'dropped'))}>
            {ja.start.closeDrop}
          </ChoiceChip>
        </ChipGroup>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button onClick={() => onMove(task)}>{ja.today.interrupt.carryMove}</Button>
          <Button variant="secondary" onClick={() => setClosing(true)}>
            {ja.today.interrupt.carryClose}
          </Button>
        </div>
      )}
    </InterruptCard>
  );
}
