// All sound is synthesised with WebAudio, so the game ships no audio files.
// Sounds made by other soldiers are positioned in 3D; the player's own are not.
export class Audio {
  constructor() {
    this.ctx = null;
    this.jetGain = null;
    this.volume = 0.5;
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

      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, len);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

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
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setListener(camera, forward) {
    if (!this.ctx) return;
    const l = this.ctx.listener, p = camera.position;
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = forward.x; l.forwardY.value = forward.y; l.forwardZ.value = forward.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  // Output node for a sound: straight to master, or through a 3D panner.
  _out(pos) {
    if (!pos) return this.master;
    const pan = this.ctx.createPanner();
    pan.panningModel = 'equalpower';
    pan.distanceModel = 'inverse';
    pan.refDistance = 30;
    pan.rolloffFactor = 1.2;
    if (pan.positionX) { pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z; }
    else pan.setPosition(pos.x, pos.y, pos.z);
    pan.connect(this.master);
    return pan;
  }

  _burst(out, { type = 'bandpass', freq, q = 1, gain, decay, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5, decay + 0.02);
  }

  _tone(out, { wave = 'sine', from, to, gain, decay, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + decay);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.02);
  }

  // A toy gun: a sharp pop rather than a boom. `profile` comes from the weapon.
  shot(pos, own, profile) {
    if (!this.ctx) return;
    const out = this._out(own ? null : pos);
    const k = own ? 0.7 : 1;
    this._burst(out, { freq: profile.noise, q: 0.7, gain: 0.55 * k, decay: profile.decay });
    this._tone(out, { wave: 'triangle', from: profile.tone, to: profile.tone / 4, gain: 0.5 * k, decay: profile.decay * 1.3 });
  }

  // Plastic breaking apart: a crack and a scatter of clicks.
  shatter(pos) {
    if (!this.ctx) return;
    const out = this._out(pos);
    this._burst(out, { type: 'highpass', freq: 1800, gain: 0.8, decay: 0.12 });
    for (let i = 0; i < 7; i++) {
      this._burst(out, { freq: 2500 + Math.random() * 3000, q: 6, gain: 0.35, decay: 0.03, delay: 0.05 + Math.random() * 0.45 });
    }
  }

  hitmarker(kill) {
    if (!this.ctx) return;
    this._tone(this.master, { from: kill ? 900 : 1500, to: kill ? 1800 : 1400, gain: 0.25, decay: kill ? 0.16 : 0.05 });
  }

  hurt() {
    if (!this.ctx) return;
    this._tone(this.master, { from: 150, to: 60, gain: 0.6, decay: 0.14 });
  }

  step() {
    if (!this.ctx) return;
    this._burst(this.master, { type: 'lowpass', freq: 700, gain: 0.12, decay: 0.04 });
  }

  reload(seconds) {
    if (!this.ctx) return;
    this._burst(this.master, { freq: 3200, q: 4, gain: 0.3, decay: 0.03 });
    this._burst(this.master, { freq: 2400, q: 4, gain: 0.35, decay: 0.04, delay: seconds * 0.55 });
    this._burst(this.master, { freq: 1500, q: 3, gain: 0.4, decay: 0.05, delay: seconds * 0.85 });
  }

  swap() {
    if (!this.ctx) return;
    this._burst(this.master, { freq: 1800, q: 3, gain: 0.25, decay: 0.04 });
  }

  jet(on) {
    if (!this.jetGain) return;
    this.jetGain.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.05);
  }
}
