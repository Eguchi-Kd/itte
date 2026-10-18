// 効果音（§5.6）。外部音源を使わず Web Audio API で合成する
export type SoundId = 'recorded' | 'timerEnd';

interface Tone {
  freq: number;
  ms: number;
}

const SOUNDS: Record<SoundId, { tones: Tone[]; volume: number }> = {
  recorded: {
    tones: [
      { freq: 523, ms: 60 },
      { freq: 784, ms: 60 },
    ],
    volume: 0.08,
  },
  timerEnd: {
    tones: [
      { freq: 659, ms: 120 },
      { freq: 784, ms: 120 },
      { freq: 988, ms: 120 },
    ],
    volume: 0.1,
  },
};

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

function audioCtor(): AudioCtor | null {
  const g = globalThis as typeof globalThis & { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** 最初のユーザー操作で呼び、AudioContext を resume する */
export function unlockAudio(): void {
  const Ctor = audioCtor();
  if (!Ctor) return;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function playSound(id: SoundId): void {
  unlockAudio();
  if (!ctx) return;
  const { tones, volume } = SOUNDS[id];
  let t = ctx.currentTime;
  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.linearRampToValueAtTime(0, t + tone.ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + tone.ms / 1000);
    t += tone.ms / 1000;
  }
}
