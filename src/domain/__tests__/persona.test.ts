import { describe, expect, it } from 'vitest';
import { choosePersona, PERSONA_ORDER } from '../persona';

describe('タイプ診断', () => {
  it('AC-CORE-07: 最も高いスコアの persona を選ぶ', () => {
    expect(choosePersona({ regret: 2, optimist: 3, meaning: 5, selfblame: 1, notfun: 4 })).toBe('meaning');
    expect(choosePersona({ regret: 1, optimist: 1, meaning: 1, selfblame: 1, notfun: 2 })).toBe('notfun');
  });

  it('AC-CORE-07: 同点のとき、表の上にある persona が選ばれる', () => {
    expect(choosePersona({ regret: 3, optimist: 3, meaning: 3, selfblame: 3, notfun: 3 })).toBe('regret');
    expect(choosePersona({ regret: 1, optimist: 4, meaning: 2, selfblame: 4, notfun: 4 })).toBe('optimist');
    expect(choosePersona({ regret: 1, optimist: 2, meaning: 5, selfblame: 5, notfun: 1 })).toBe('meaning');
    expect(choosePersona({ regret: 1, optimist: 2, meaning: 3, selfblame: 5, notfun: 5 })).toBe('selfblame');
  });

  it('表の順は regret, optimist, meaning, selfblame, notfun', () => {
    expect(PERSONA_ORDER).toEqual(['regret', 'optimist', 'meaning', 'selfblame', 'notfun']);
  });
});
