let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;

  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }

  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

// Short note sequences for drill events: [frequency in Hz, start in s, length in s].
const DRILL_SOUNDS = {
  start: [[659.25, 0, 0.08], [880, 0.09, 0.1]],
  phase: [[523.25, 0, 0.08], [783.99, 0.09, 0.12]],
  target: [[523.25, 0, 0.08], [659.25, 0.09, 0.08], [783.99, 0.18, 0.14]],
  end: [[783.99, 0, 0.1], [523.25, 0.11, 0.16]],
  record: [[523.25, 0, 0.08], [659.25, 0.09, 0.08], [783.99, 0.18, 0.08], [1046.5, 0.27, 0.18]],
};

export function playDrillSound(kind, volume = 0.5) {
  if (volume <= 0) return;
  const notes = DRILL_SOUNDS[kind];
  const ctx = getAudioContext();
  if (!ctx || !notes) return;

  try {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(Math.min(1, Math.max(0, volume)), now);
    master.connect(ctx.destination);

    for (const [freq, start, length] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.25, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + length);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + start);
      osc.stop(now + start + length);
    }
  } catch (err) {
    // Web Audio may be blocked; drills work without sound.
  }
}

export function playStrafeSound(type, volume = 0.5) {
  if (volume <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.min(1, Math.max(0, volume)), now);
    masterGain.connect(ctx.destination);

    if (type === "Perfect") {
      // Crisp, crystalline high chime (C6 -> E6 harmonic)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1046.5, now); // C6
      osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08); // E6

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1567.98, now); // G6

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.09);
      osc2.stop(now + 0.09);
    } else if (type === "Early") {
      // Neutral, pleasant mid tone (C5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === "Late") {
      // Slightly deeper, softer tone (A3)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(220.0, now); // A3

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.09);
    }
  } catch (err) {
    // Graceful fallback if Web Audio is blocked by browser policy
  }
}
