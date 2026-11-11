// Render resolution control. In 'auto' it lowers the pixel density when the
// frame rate drops and raises it again when there is headroom, which is the
// single most effective way to stay smooth on laptops and integrated GPUs.
const FIXED = { low: 0.6, medium: 0.8, high: 1 };
const MIN = 0.5;

export class Resolution {
  constructor(renderer) {
    this.renderer = renderer;
    this.max = Math.min(window.devicePixelRatio || 1, 2);
    this.autoMax = Math.min(this.max, 1.5); // Auto never pushes past this: it leaves headroom for busy moments
    this.mode = 'auto';
    this.scale = this.autoMax;
    this.ceiling = this.autoMax;   // highest scale known not to cause a drop
    this.time = 0;
    this.frames = 0;
    this.goodSeconds = 0;
    this.badSeconds = 0;
    renderer.setPixelRatio(this.scale);
  }

  setMode(mode) {
    this.mode = mode;
    this.ceiling = this.autoMax;
    this.goodSeconds = 0;
    this.set(mode === 'auto' ? this.autoMax : this.max * FIXED[mode]);
  }

  set(scale) {
    scale = Math.max(MIN, Math.min(this.max, Math.round(scale * 20) / 20));
    if (scale === this.scale) return;
    this.scale = scale;
    this.renderer.setPixelRatio(scale);
  }

  // Call once per rendered frame with the real (uncapped) frame time.
  update(rawDt, active) {
    if (this.mode !== 'auto' || !active || rawDt > 1) { this.time = 0; this.frames = 0; return; }
    this.time += rawDt;
    this.frames++;
    if (this.time < 1) return;
    const fps = this.frames / this.time;
    this.time = 0;
    this.frames = 0;

    if (fps < 50) {
      this.goodSeconds = 0;
      // One slow second is usually a momentary spike, and changing resolution
      // itself costs a hitch. Only react to a sustained drop.
      if (++this.badSeconds < 2) return;
      this.badSeconds = 0;
      this.ceiling = Math.max(MIN, this.scale - 0.05);
      this.set(this.scale * (fps < 35 ? 0.75 : 0.9));
    } else if (fps > 57 && this.scale < this.ceiling) {
      this.badSeconds = 0;
      if (++this.goodSeconds >= 3) { this.set(this.scale + 0.1); this.goodSeconds = 0; }
    } else {
      this.goodSeconds = 0;
      this.badSeconds = 0;
    }
  }
}
