// Tiny Web Audio cues for Just the Facts. Every function is a no-op when the
// AudioContext is unavailable (SSR, tests, old browsers) or sound is off.

let ctx = null;

function getCtx() {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(freq, durationMs, { type = "sine", gain = 0.08, delayMs = 0 } = {}) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t0 = c.currentTime + delayMs / 1000;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(amp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

export function createSound(enabledRef) {
  const on = () => !!(enabledRef && enabledRef.current);
  return {
    click: () => on() && tone(720, 35, { type: "square", gain: 0.03 }),
    good: () => {
      if (!on()) return;
      tone(660, 90);
      tone(990, 140, { delayMs: 70 });
    },
    slow: () => on() && tone(440, 160, { type: "triangle" }),
    bad: () => on() && tone(180, 260, { type: "sawtooth", gain: 0.05 }),
    unlock: () => {
      // Call from a user gesture so iOS lets the context start.
      const c = getCtx();
      if (c && c.state === "suspended") c.resume().catch(() => {});
    },
  };
}
