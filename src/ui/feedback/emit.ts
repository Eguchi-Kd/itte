import type { Settings } from '../../domain/types';
import type { FeedbackSpec } from './feedbackFor';
import { vibrate } from './haptics';
import { playSound } from './sound';

/** 設定に従って音と振動を出す */
export function emitFeedback(spec: FeedbackSpec, settings: Pick<Settings, 'soundOn' | 'hapticsOn'> | undefined): void {
  if (settings?.soundOn ?? true) playSound(spec.sound);
  if (settings?.hapticsOn ?? true) vibrate(spec.haptic);
}
