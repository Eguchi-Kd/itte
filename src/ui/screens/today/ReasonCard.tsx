import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { formatDateShort } from '../../../domain/display';
import type { ReasonPrompt } from '../../../domain/habits/reasons';
import type { Habit, ReasonTag } from '../../../domain/types';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { InterruptCard } from '../../components/InterruptCard';

interface Props {
  prompts: ReasonPrompt[];
  habits: Habit[];
  tags: ReasonTag[];
  onTag: (prompt: ReasonPrompt, tagIds: string[]) => void;
  onLater: () => void;
}

/** 記録なしの理由（割り込みカード2）。タグを1つ押した時点で記録し、次の1件に進む */
export function ReasonCard({ prompts, habits, tags, onTag, onLater }: Props) {
  const prompt = prompts[0];
  const habit = habits.find((h) => h.id === prompt.habitId);
  if (!habit) return null;
  return (
    <InterruptCard onLater={onLater} testId="reason-card">
      <p className="pr-14 text-body" data-testid="reason-question">
        {fill(ja.today.interrupt.reasonQ, { date: formatDateShort(prompt.date), habit: habit.name })}
      </p>
      <ChipGroup label={ja.today.interrupt.reasonTags} className="mt-3">
        {tags
          .filter((t) => !t.archived)
          .map((t) => (
            <ChoiceChip key={t.id} selected={false} onToggle={() => onTag(prompt, [t.id])}>
              {t.label}
            </ChoiceChip>
          ))}
        <ChoiceChip selected={false} onToggle={() => onTag(prompt, [])}>
          {ja.today.interrupt.noReason}
        </ChoiceChip>
      </ChipGroup>
    </InterruptCard>
  );
}
