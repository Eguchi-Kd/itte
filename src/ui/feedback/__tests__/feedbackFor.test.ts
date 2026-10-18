import { describe, expect, it, vi } from 'vitest';
import { feedbackFor, type FeedbackEvent } from '../feedbackFor';
import { emitFeedback } from '../emit';
import { copyByKey } from '../../../copy/fill';

describe('feedbackFor', () => {
  it('AC-UX-04: 判定の届いた／届かなかったで深い等価', () => {
    expect(feedbackFor({ type: 'judgment', outcome: 'MET' })).toEqual(
      feedbackFor({ type: 'judgment', outcome: 'UNMET' }),
    );
    expect(feedbackFor({ type: 'judgment', outcome: 'MET' }).copyKey).toBe('feedback.judgmentRecorded');
  });

  it('AC-UX-04: 感想戦の好手／普通／悪手で深い等価', () => {
    const good = feedbackFor({ type: 'moveReview', rating: 'good' });
    expect(feedbackFor({ type: 'moveReview', rating: 'bad' })).toEqual(good);
    expect(feedbackFor({ type: 'moveReview', rating: 'neutral' })).toEqual(good);
  });

  it('AC-UX-04: やった と 記録なし で sound・haptic・variant が同じで、文言も同じ', () => {
    const done = feedbackFor({ type: 'habitDone' });
    const missed = feedbackFor({ type: 'habitMissed' });
    expect(missed).toEqual(done);
    expect(copyByKey(done.copyKey)).toBe('記録しました');
  });

  it('AC-UX-04: どのイベントでも sound・haptic・variant は定数で、copyKey は辞書にある', () => {
    const events: FeedbackEvent[] = [
      { type: 'habitDone' },
      { type: 'habitMissed' },
      { type: 'judgment', outcome: 'MET' },
      { type: 'judgment', outcome: 'UNMET' },
      { type: 'moveDecided' },
      { type: 'moveReview', rating: 'good' },
      { type: 'moveReview', rating: 'bad' },
      { type: 'stuck' },
      { type: 'escape' },
      { type: 'daily' },
      { type: 'measurement' },
      { type: 'saved' },
    ];
    for (const e of events) {
      const spec = feedbackFor(e);
      expect({ sound: spec.sound, haptic: spec.haptic, variant: spec.variant }).toEqual({
        sound: 'recorded',
        haptic: 'recorded',
        variant: 'neutral',
      });
      expect(copyByKey(spec.copyKey)).not.toBe(copyByKey('errors.unknown'));
    }
  });

  it('振動は設定でオフにできる', () => {
    const vib = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true });
    emitFeedback(feedbackFor({ type: 'habitDone' }), { soundOn: false, hapticsOn: true });
    expect(vib).toHaveBeenCalledWith(8);
    vib.mockClear();
    emitFeedback(feedbackFor({ type: 'habitDone' }), { soundOn: false, hapticsOn: false });
    expect(vib).not.toHaveBeenCalled();
  });
});
