// データ（#/settings/data、§6.12）。書き出し・読み込み・盤面に予定を読み込む・永続化の状態・整合性・全データ削除
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ja } from '../../../copy/ja';
import { copyByKey, fill } from '../../../copy/fill';
import { checkIntegrity } from '../../../db/queries/integrity';
import { importIcs } from '../../../db/repo/board';
import { exportCsvZip, exportJson, importJson, startFresh, validateImport, wipeAll } from '../../../db/repo/common';
import { logicalDate } from '../../../domain/dates';
import { isDomainError } from '../../../domain/errors';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CheckSheet } from '../../components/CheckSheet';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TwoStepConfirm } from '../../components/TwoStepConfirm';
import { downloadBlob, downloadText } from '../../download';
import { useFeedback } from '../../feedback/FeedbackProvider';

async function readFile(file: File): Promise<string> {
  return typeof file.text === 'function'
    ? file.text()
    : new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsText(file);
      });
}

export default function DataSettings() {
  const navigate = useNavigate();
  const { notify, toast } = useFeedback();
  const [persist, setPersist] = useState<boolean | null>(null);
  const [integrity, setIntegrity] = useState<string | null>(null);
  const [pending, setPending] = useState<{ text: string; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersist, () => setPersist(null));
  }, []);

  const fail = (e: unknown) => setMessage(copyByKey(isDomainError(e) ? e.copyKey : 'errors.unknown'));

  return (
    <main className="flex flex-col gap-3 px-4 pb-8" data-testid="data-settings">
      <ScreenHeader title={ja.settings.dataTitle} fallback="/settings" />

      <Card className="flex flex-col gap-2">
        <Button
          block
          variant="secondary"
          onClick={async () => {
            const { fileName, text } = await exportJson(Date.now());
            downloadText(fileName, text, 'application/json');
            notify({ type: 'saved' });
          }}
        >
          {ja.settings.exportJson}
        </Button>
        <Button
          block
          variant="secondary"
          onClick={async () => {
            const { fileName, bytes } = await exportCsvZip(Date.now());
            downloadBlob(fileName, new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
            notify({ type: 'saved' });
          }}
        >
          {ja.settings.exportCsv}
        </Button>
      </Card>

      <Card className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-label">{ja.settings.importJson}</span>
          <input
            type="file"
            accept="application/json,.json"
            data-testid="import-json"
            className="text-body"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setMessage(null);
              try {
                const text = await readFile(file);
                const { summary } = validateImport(text);
                const total = Object.values(summary.counts).reduce((s, n) => s + (n ?? 0), 0);
                setPending({ text, total });
              } catch (err) {
                fail(err);
              }
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label">{ja.settings.importIcs}</span>
          <input
            type="file"
            accept="text/calendar,.ics"
            data-testid="import-ics"
            className="text-body"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const now = Date.now();
              const n = await importIcs(await readFile(file), logicalDate(now), now);
              setMessage(fill(ja.settings.icsImported, { n }));
            }}
          />
        </label>
        {message && (
          <p role="alert" className="text-body" data-testid="data-message">
            {message}
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-label">{ja.settings.persist}</p>
        <p className="text-body" data-testid="persist-status">
          {persist === null ? ja.settings.persistUnknown : persist ? ja.settings.persistGranted : ja.settings.persistDenied}
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-label">{ja.settings.integrity}</p>
        <Button
          variant="secondary"
          onClick={async () => {
            const r = await checkIntegrity();
            setIntegrity(r.ok ? fill(ja.settings.integrityOk, { n: r.count }) : fill(ja.settings.integrityNg, { table: r.table, seq: r.seq }));
          }}
        >
          {ja.settings.integrityCheck}
        </Button>
        {integrity && (
          <p className="text-body" data-testid="integrity-result">
            {integrity}
          </p>
        )}
      </Card>

      <Button size="lg" block variant="danger" onClick={() => setWiping(true)}>
        {ja.settings.wipe}
      </Button>

      <CheckSheet
        open={pending !== null}
        title={ja.settings.importReplace}
        confirmLabel={ja.settings.importJson}
        busy={busy}
        onFix={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          setBusy(true);
          try {
            await importJson(pending.text, Date.now());
            setPending(null);
            toast(ja.settings.importDone);
            navigate('/', { replace: true });
          } catch (err) {
            setPending(null);
            fail(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        {pending && <p className="text-body">{fill(ja.settings.importSummary, { n: pending.total })}</p>}
      </CheckSheet>

      <TwoStepConfirm
        open={wiping}
        busy={busy}
        onClose={() => setWiping(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await wipeAll();
            await startFresh(Date.now());
            setWiping(false);
            navigate('/onboarding', { replace: true });
          } finally {
            setBusy(false);
          }
        }}
      />
    </main>
  );
}
