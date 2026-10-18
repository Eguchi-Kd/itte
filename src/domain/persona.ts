// タイプ診断（§6.4）
import type { Persona } from './types';

/** 診断の表の順。同点なら上にあるものを選ぶ */
export const PERSONA_ORDER: readonly Persona[] = ['regret', 'optimist', 'meaning', 'selfblame', 'notfun'];

export function choosePersona(scores: Record<Persona, number>): Persona {
  let best: Persona = PERSONA_ORDER[0];
  for (const p of PERSONA_ORDER) if (scores[p] > scores[best]) best = p;
  return best;
}
