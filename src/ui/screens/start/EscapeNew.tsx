// 逃避ログ（#/escape/new、シート形式の全画面）
import { useNavigate, useSearchParams } from 'react-router';
import { ja } from '../../../copy/ja';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EscapeForm } from './EscapeForm';

export default function EscapeNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId');
  return (
    <main className="flex flex-col gap-4 px-4 pb-8" data-testid="escape-new">
      <ScreenHeader title={ja.start.escape.title} fallback="/" />
      {sessionId && <p className="text-body">{ja.start.escapeIntro}</p>}
      <EscapeForm sessionId={sessionId} onDone={() => navigate('/', { replace: true })} />
    </main>
  );
}
