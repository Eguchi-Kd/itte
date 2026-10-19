// 設定（#/settings、§6.12）。音・振動、理由タグ、タイプ診断のやり直し、足踏みの判定、カレンダーへのまとめ書き出し、バージョン
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { APP_NAME, APP_VERSION } from '../../../config';
import { ja } from '../../../copy/ja';
import { fill } from '../../../copy/fill';
import { queryGoalsData } from '../../../db/queries/goals';
import { queryWeeklyData } from '../../../db/queries/review';
import { updateSettings } from '../../../db/repo/common';
import { saveReasonTag } from '../../../db/repo/habits';
import { logicalDate } from '../../../domain/dates';
import { weekdayLabel } from '../../../domain/display';
import { exportAllIcs } from '../../../domain/ics';
import type { ReasonTag } from '../../../domain/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CheckSheet } from '../../components/CheckSheet';
import { ChoiceChip, ChipGroup } from '../../components/ChoiceChip';
import { ListRow } from '../../components/ListRow';
import { NumberStepper } from '../../components/NumberStepper';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { downloadText } from '../../download';
import { useFeedback } from '../../feedback/FeedbackProvider';
import { useSettings } from '../../hooks/useSettings';

export default function Settings() {
  const settings = useSettings();
  const data = useLiveQuery(() => queryWeeklyData(), []);
  const goals = useLiveQuery(() => queryGoalsData(), []);
  const [newTag, setNewTag] = useState('');
  const [demoOpen, setDemoOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useFeedback();
  if (!settings || !data || !goals) return null;
  const save = (patch: Parameters<typeof updateSettings>[0]) => void updateSettings(patch, Date.now());
  const tags = [...data.tags].sort((a, b) => a.order - b.order);

  return (
    <main className="flex flex-col gap-3 px-4 pb-8" data-testid="settings">
      <ScreenHeader title={ja.settings.title} fallback="/" />
      <Card className="flex flex-col gap-2">
        <Toggle label={ja.settings.sound} checked={settings.soundOn} onChange={(v) => save({ soundOn: v })} />
        <Toggle label={ja.settings.haptics} checked={settings.hapticsOn} onChange={(v) => save({ hapticsOn: v })} />
      </Card>

      <Card className="flex flex-col gap-2" data-testid="tag-settings">
        <h2 className="text-h2">{ja.settings.tags}</h2>
        {tags.map((t) => (
          <TagRow key={t.id} tag={t} />
        ))}
        <TextField label={ja.settings.tagAdd} value={newTag} onChange={setNewTag} maxLength={12} />
        <Button
          variant="secondary"
          disabled={newTag.trim().length === 0}
          onClick={async () => {
            await saveReasonTag({ label: newTag });
            setNewTag('');
          }}
        >
          {ja.settings.tagAdd}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-h2">{ja.settings.stallThresholds}</h2>
        <NumberStepper
          label={ja.settings.thresholdExtension}
          value={settings.stallExtensionThreshold}
          onChange={(v) => v && save({ stallExtensionThreshold: v })}
          min={1}
          max={20}
          decrementLabel={ja.common.decrement}
          incrementLabel={ja.common.increment}
        />
        <NumberStepper
          label={ja.settings.thresholdFollowUp}
          value={settings.stallFollowUpDays}
          onChange={(v) => v && save({ stallFollowUpDays: v })}
          min={1}
          max={365}
          decrementLabel={ja.common.decrement}
          incrementLabel={ja.common.increment}
        />
        <NumberStepper
          label={ja.settings.thresholdRepeated}
          value={settings.stallRepeatedUnmet}
          onChange={(v) => v && save({ stallRepeatedUnmet: v })}
          min={2}
          max={20}
          decrementLabel={ja.common.decrement}
          incrementLabel={ja.common.increment}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-h2">{ja.settings.weeklyIcs}</h2>
        <ChipGroup label={ja.settings.weekday}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <ChoiceChip
              key={d}
              selected={settings.weeklyReviewIcs.weekday === d}
              onToggle={() => save({ weeklyReviewIcs: { ...settings.weeklyReviewIcs, weekday: d } })}
            >
              {weekdayLabel(d)}
            </ChoiceChip>
          ))}
        </ChipGroup>
        <TextField
          label={ja.settings.time}
          type="time"
          value={settings.weeklyReviewIcs.time}
          onChange={(v) => v && save({ weeklyReviewIcs: { ...settings.weeklyReviewIcs, time: v } })}
          maxLength={5}
        />
        <Button
          variant="secondary"
          onClick={() => {
            const text = exportAllIcs(data.habits, goals.goals, settings, logicalDate(Date.now()), fill(ja.settings.weeklyIcsTitle, { app: APP_NAME }));
            downloadText(ja.settings.icsFile, text, 'text/calendar');
          }}
        >
          {ja.settings.icsAll}
        </Button>
      </Card>

      <div className="card p-0">
        <ListRow to="/onboarding" title={ja.settings.redoPersona} />
        <ListRow to="/settings/data" title={ja.settings.dataLink} />
      </div>
      {import.meta.env.DEV && (
        <>
          <Button variant="secondary" onClick={() => setDemoOpen(true)}>
            {ja.settings.demo}
          </Button>
          <CheckSheet
            open={demoOpen}
            title={ja.settings.importReplace}
            confirmLabel={ja.settings.demo}
            onFix={() => setDemoOpen(false)}
            onConfirm={async () => {
              // 開発用。本番のビルドには含めない（import.meta.env.DEV が false なら読み込まない）
              const { loadDemoData } = await import('../../../db/seedDemo');
              await loadDemoData(Date.now());
              setDemoOpen(false);
              toast(ja.settings.demoDone);
              navigate('/', { replace: true });
            }}
          />
        </>
      )}
      <p className="text-caption text-text-2">
        {ja.settings.version}: {APP_VERSION}
      </p>
      <Link to="/library" className="sr-only">
        {ja.nav.library}
      </Link>
    </main>
  );
}

function TagRow({ tag }: { tag: ReasonTag }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(tag.label);
  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <TextField label={ja.settings.tagLabel} value={label} onChange={setLabel} maxLength={12} />
        <Button
          disabled={label.trim().length === 0}
          onClick={async () => {
            await saveReasonTag({ id: tag.id, label });
            setEditing(false);
          }}
        >
          {ja.common.save}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex min-h-12 items-center gap-2" data-testid={`tag-${tag.id}`}>
      <span className={`min-w-0 flex-1 text-body ${tag.archived ? 'text-text-2 line-through' : ''}`}>{tag.label}</span>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        {ja.settings.tagRename}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void saveReasonTag({ id: tag.id, label: tag.label, archived: !tag.archived })}>
        {tag.archived ? ja.settings.tagShow : ja.settings.tagHide}
      </Button>
    </div>
  );
}
