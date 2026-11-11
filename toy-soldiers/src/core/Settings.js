const KEY = 'toy-soldiers-settings-v1';

export const DEFAULTS = {
  sensitivity: 1,      // multiplier on mouse and stick look speed
  invertY: false,
  volume: 0.5,
  fov: 75,
  difficulty: 'normal',
  shadows: 'high',
  night: false,
  thirdPerson: false,
};

// What the settings screen shows, in order.
export const SCHEMA = [
  { key: 'difficulty', label: 'Bot difficulty', options: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']] },
  { key: 'sensitivity', label: 'Look sensitivity', min: 0.2, max: 3, step: 0.05, format: (v) => `${v.toFixed(2)}×` },
  { key: 'invertY', label: 'Invert vertical look', toggle: true },
  { key: 'fov', label: 'Field of view', min: 60, max: 100, step: 1, format: (v) => `${v}°` },
  { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'thirdPerson', label: 'Camera', options: [[false, 'First person'], [true, 'Third person']] },
  { key: 'night', label: 'Time of day', options: [[false, 'Day'], [true, 'Night']] },
  { key: 'shadows', label: 'Shadow quality', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']] },
];

// Player preferences, saved in this browser. Storage can be unavailable
// (private windows, blocked site data), so every access is guarded and the
// game runs on defaults without it.
export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    this.onChange = null; // (key, value) => void
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      for (const k of Object.keys(DEFAULTS)) {
        if (typeof saved[k] === typeof DEFAULTS[k]) this.values[k] = saved[k];
      }
    } catch { /* keep defaults */ }
  }

  get(key) { return this.values[key]; }

  set(key, value) {
    if (this.values[key] === value) return;
    this.values[key] = value;
    try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* not saved */ }
    this.onChange?.(key, value);
  }

  reset() {
    for (const k of Object.keys(DEFAULTS)) this.set(k, DEFAULTS[k]);
  }
}
