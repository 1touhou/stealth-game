// Sound, synthesized live with WebAudio: no audio files, nothing to download.
// Footsteps tick under the player, a soft "huh?" marks a guard growing
// suspicious, an alarm sting marks a chase, and a chime marks a stolen relic.
export function createSoundBank() {
  let context = null;
  let ambient = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function tone(frequency, duration, type, gainValue, when = 0) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const start = ctx.currentTime + when;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(gainValue, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noiseBurst(duration, gainValue, filterFrequency) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  return {
    /** Start the low night-gallery drone; safe to call more than once. */
    startAmbient() {
      const ctx = ensure();
      if (!ctx || ambient || muted) return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 55;
      gain.gain.value = 0.018;
      const wobble = ctx.createOscillator();
      const wobbleGain = ctx.createGain();
      wobble.frequency.value = 0.07;
      wobbleGain.gain.value = 0.008;
      wobble.connect(wobbleGain);
      wobbleGain.connect(gain.gain);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      wobble.start();
      ambient = { oscillator, wobble };
    },
    /** A footstep: soft while sneaking, sharp while running. */
    footstep(running, sneaking) {
      if (sneaking) noiseBurst(0.05, 0.05, 500);
      else if (running) noiseBurst(0.07, 0.16, 900);
      else noiseBurst(0.06, 0.09, 700);
    },
    /** A guard's questioning "huh?" as suspicion crosses the line. */
    question() {
      tone(392, 0.12, 'triangle', 0.08);
      tone(523, 0.14, 'triangle', 0.07, 0.1);
    },
    /** The alarm sting when a guard starts the chase. */
    alarm() {
      tone(220, 0.22, 'sawtooth', 0.09);
      tone(330, 0.22, 'sawtooth', 0.09, 0.16);
      tone(220, 0.3, 'sawtooth', 0.09, 0.32);
    },
    /** A bright chime when a relic is pocketed. */
    relic() {
      tone(880, 0.25, 'sine', 0.1);
      tone(1318, 0.35, 'sine', 0.08, 0.09);
    },
    /** A pebble skittering across the floor. */
    pebble() {
      noiseBurst(0.05, 0.1, 2400);
      noiseBurst(0.04, 0.07, 1800);
    },
    /** The low win arpeggio when the player slips out the exit. */
    win() {
      [523, 659, 784, 1046].forEach((frequency, index) => tone(frequency, 0.4, 'sine', 0.09, index * 0.12));
    },
    /** The dull thud of being caught. */
    caught() {
      tone(110, 0.5, 'sawtooth', 0.12);
      tone(82, 0.6, 'sawtooth', 0.1, 0.15);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
