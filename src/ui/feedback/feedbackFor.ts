// 結果非依存のフィードバック（§2.2、§8.11）。音・振動・見た目は記録の種類にも結果にも依存しない
import type { JudgmentOutcome, Rating } from '../../domain/types';

export type FeedbackEvent =
  | { type: 'habitDone' }
  | { type: 'habitMissed' }
  | { type: 'judgment'; outcome: JudgmentOutcome }
  | { type: 'moveDecided' }
  | { type: 'moveReview'; rating: Rating }
  | { type: 'stuck'; stopped?: boolean }
  | { type: 'escape' }
  | { type: 'daily' }
  | { type: 'measurement' }
  | { type: 'saved' };

export interface FeedbackSpec {
  sound: 'recorded';
  haptic: 'recorded';
  variant: 'neutral';
  copyKey: string;
}

const COPY_KEY: Record<FeedbackEvent['type'], string> = {
  habitDone: 'feedback.recorded',
  habitMissed: 'feedback.recorded',
  judgment: 'feedback.judgmentRecorded',
  moveDecided: 'feedback.recorded',
  moveReview: 'feedback.recorded',
  stuck: 'feedback.stuckContinue',
  escape: 'feedback.recorded',
  daily: 'feedback.recorded',
  measurement: 'feedback.recorded',
  saved: 'feedback.saved',
};

export function feedbackFor(e: FeedbackEvent): FeedbackSpec {
  // 詰まりで「止める」を選んだときはタイマーが続かないので「記録しました」（§6.6.5）。結果の良し悪しではない
  const copyKey = e.type === 'stuck' && e.stopped ? 'feedback.recorded' : COPY_KEY[e.type];
  return { sound: 'recorded', haptic: 'recorded', variant: 'neutral', copyKey };
}
