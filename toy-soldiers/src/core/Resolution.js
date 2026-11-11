// Render resolution control. In 'auto' it lowers the pixel density when the
// frame rate drops and raises it again when there is headroom, which is the
// single most effective way to stay smooth on laptops and integrated GPUs.
const FIXED = { low: 0.6, medium: 0.8, high: 1 };
const MIN = 0.5;

export class Resolution {
  constructor(renderer) {
    this.renderer = renderer;
    this.max = Math.min(window.devicePixelRatio || 1, 2);
    this.mode = 'auto';
    this.scale = Math.min(this.max, 1.5);
    this.ceiling = this.max;   // highest scale known not to cause a drop
    this.time = 0;
    this.frames = 0;
    this.goodSeconds = 0;
    renderer.setPixelRatio(this.scale);
  }

  setMode(mode) {
    this.mode = mode;
    this.ceiling = this.max;
    this.goodSeconds = 0;
    this.set(mode === 'auto' ? Math.min(this.max, 1.5) : this.max * FIXED[mode]);
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
      // Drop faster the further below target we are.
      this.ceiling = Math.max(MIN, this.scale - 0.05);
      this.set(this.scale * (fps < 35 ? 0.75 : 0.9));
      this.goodSeconds = 0;
    } else if (fps > 57 && this.scale < this.ceiling) {
      if (++this.goodSeconds >= 3) { this.set(this.scale + 0.1); this.goodSeconds = 0; }
    } else {
      this.goodSeconds = 0;
    }
  }
}
