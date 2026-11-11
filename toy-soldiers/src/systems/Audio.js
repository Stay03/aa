import { CONFIG } from '../config.js';

// All sound is synthesised, so the game ships no audio files.
//
// The frequent sounds (every weapon's shot, the plastic shatter) are rendered
// once into buffers when audio starts. Playing one is then a single buffer
// source with a gain and a pan, instead of building a fresh synth graph per
// shot, which was costing whole frames in a firefight.
const MAX_VOICES = 14;

function makeNoise(sampleRate) {
  const buf = new AudioBuffer({ length: sampleRate, sampleRate, numberOfChannels: 1 });
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function burst(ac, noise, out, { type = 'bandpass', freq, q = 1, gain, decay, delay = 0 }) {
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5, decay + 0.02);
}

function tone(ac, out, { wave = 'sine', from, to, gain, decay, delay = 0 }) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = wave;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + decay);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + decay + 0.02);
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.jetGain = null;
    this.volume = 0.5;
    this.buffers = new Map(); // weapon sound profile | 'shatter' -> AudioBuffer
    this.voices = 0;
    this.lastBotShot = 0;
    this.listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  // Must be called from a user gesture (browser autoplay rules).
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.noise = makeNoise(this.ctx.sampleRate);

      // Jetpack: one looping hiss whose volume we ride.
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.6;
      this.jetGain = this.ctx.createGain();
      this.jetGain.gain.value = 0;
      src.connect(bp).connect(this.jetGain).connect(this.master);
      src.start();

      this.prerender();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  async render(seconds, build) {
    const rate = this.ctx.sampleRate;
    const off = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
    build(off, off.destination);
    return off.startRendering();
  }

  prerender() {
    for (const def of Object.values(CONFIG.weapons)) {
      const p = def.sound;
      this.render(p.decay * 1.3 + 0.08, (ac, out) => {
        burst(ac, this.noise, out, { freq: p.noise, q: 0.7, gain: 0.55, decay: p.decay });
        tone(ac, out, { wave: 'triangle', from: p.tone, to: p.tone / 4, gain: 0.5, decay: p.decay * 1.3 });
      }).then((buf) => this.buffers.set(p, buf)).catch(() => {});
    }
    // Plastic breaking apart: a crack and a scatter of clicks.
    this.render(0.65, (ac, out) => {
      burst(ac, this.noise, out, { type: 'highpass', freq: 1800, gain: 0.8, decay: 0.12 });
      for (let i = 0; i < 7; i++) {
        burst(ac, this.noise, out, { freq: 2500 + Math.random() * 3000, q: 6, gain: 0.35, decay: 0.03, delay: 0.05 + Math.random() * 0.45 });
      }
    }).then((buf) => this.buffers.set('shatter', buf)).catch(() => {});
  }

  setListener(camera, forward) {
    const l = this.listener, p = camera.position;
    l.x = p.x; l.y = p.y; l.z = p.z;
    // Right vector on the ground plane, for left/right panning.
    const len = Math.hypot(forward.x, forward.z) || 1;
    l.rx = -forward.z / len;
    l.rz = forward.x / len;
  }

  // Play a pre-rendered buffer. With `pos` it is attenuated by distance and
  // panned left/right relative to the listener.
  play(key, pos, gain = 1) {
    const buf = this.buffers.get(key);
    if (!this.ctx || !buf || this.voices >= MAX_VOICES) return;
    let pan = 0;
    if (pos) {
      const l = this.listener;
      const dx = pos.x - l.x, dy = pos.y - l.y, dz = pos.z - l.z;
      const d = Math.hypot(dx, dy, dz);
      gain *= Math.min(1, 30 / (30 + 1.2 * Math.max(0, d - 30)));
      if (gain < 0.02) return;
      if (d > 1) pan = Math.max(-1, Math.min(1, (dx * l.rx + dz * l.rz) / d)) * 0.8;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.95 + Math.random() * 0.1;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    let out = g;
    if (pos && this.ctx.createStereoPanner) {
      out = this.ctx.createStereoPanner();
      out.pan.value = pan;
      g.connect(out);
    }
    src.connect(g);
    out.connect(this.master);
    this.voices++;
    src.onended = () => { this.voices--; out.disconnect(); };
    src.start();
  }

  // A toy gun: a sharp pop rather than a boom. `profile` comes from the weapon.
  shot(pos, own, profile) {
    if (!this.ctx) return;
    if (own) { this.play(profile, null, 0.7); return; }
    // Several bots firing in the same instant read as one sound anyway.
    const now = this.ctx.currentTime;
    if (now - this.lastBotShot < 0.03) return;
    this.lastBotShot = now;
    this.play(profile, pos, 1);
  }

  shatter(pos) {
    this.play('shatter', pos, 1);
  }

  // The rest are rare, player-only sounds: synthesised live.
  hitmarker(kill) {
    if (!this.ctx) return;
    tone(this.ctx, this.master, { from: kill ? 900 : 1500, to: kill ? 1800 : 1400, gain: 0.25, decay: kill ? 0.16 : 0.05 });
  }

  hurt() {
    if (!this.ctx) return;
    tone(this.ctx, this.master, { from: 150, to: 60, gain: 0.6, decay: 0.14 });
  }

  step() {
    if (!this.ctx) return;
    burst(this.ctx, this.noise, this.master, { type: 'lowpass', freq: 700, gain: 0.12, decay: 0.04 });
  }

  reload(seconds) {
    if (!this.ctx) return;
    burst(this.ctx, this.noise, this.master, { freq: 3200, q: 4, gain: 0.3, decay: 0.03 });
    burst(this.ctx, this.noise, this.master, { freq: 2400, q: 4, gain: 0.35, decay: 0.04, delay: seconds * 0.55 });
    burst(this.ctx, this.noise, this.master, { freq: 1500, q: 3, gain: 0.4, decay: 0.05, delay: seconds * 0.85 });
  }

  swap() {
    if (!this.ctx) return;
    burst(this.ctx, this.noise, this.master, { freq: 1800, q: 3, gain: 0.25, decay: 0.04 });
  }

  jet(on) {
    if (!this.jetGain) return;
    this.jetGain.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05);
  }
}
